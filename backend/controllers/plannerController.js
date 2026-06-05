const pool = require('../config/database');

function sanitizeConfig(input) {
    const blockSizeHours = Number(input?.blockSizeHours);
    const startMinutes = Number(input?.startMinutes);
    const endMinutes = Number(input?.endMinutes);

    if (![1, 2, 3].includes(blockSizeHours)) {
        return { error: 'blockSizeHours invalide' };
    }
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
        return { error: 'startMinutes/endMinutes invalides' };
    }
    if (endMinutes <= startMinutes) {
        return { error: 'Plage horaire invalide' };
    }

    return {
        blockSizeHours,
        startMinutes,
        endMinutes
    };
}

function normalizeEntries(entriesInput) {
    const result = [];
    const entries = entriesInput && typeof entriesInput === 'object' ? entriesInput : {};

    for (const [key, value] of Object.entries(entries)) {
        const [dayPart, slotPart] = String(key).split('|');
        const [startPart, endPart] = String(slotPart || '').split('-');
        const dayIndex = Number(dayPart);
        const startMinutes = Number(startPart);
        const endMinutes = Number(endPart);

        if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) continue;
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) continue;

        const title = String(value?.title || '').trim();
        const details = String(value?.details || '').trim();
        if (!title) continue;

        result.push({
            dayIndex,
            slotKey: `${startMinutes}-${endMinutes}`,
            title: title.slice(0, 180),
            details: details.slice(0, 500)
        });
    }

    return result;
}

const getWeeklyPlanner = async (req, res) => {
    try {
        const userId = Number(req.user.id);

        const configResult = await pool.query(
            `SELECT block_size_hours, start_minutes, end_minutes
             FROM weekly_planner_config
             WHERE user_id = $1`,
            [userId]
        );

        const entryResult = await pool.query(
            `SELECT day_index, slot_key, title, details
             FROM weekly_planner_entry
             WHERE user_id = $1
             ORDER BY day_index ASC, slot_key ASC`,
            [userId]
        );

        const config = configResult.rows[0] || {
            block_size_hours: 1,
            start_minutes: 8 * 60,
            end_minutes: 20 * 60
        };

        const entries = {};
        entryResult.rows.forEach((row) => {
            const slotKey = `${row.day_index}|${row.slot_key}`;
            entries[slotKey] = {
                title: row.title,
                details: row.details || ''
            };
        });

        res.json({
            config: {
                blockSizeHours: Number(config.block_size_hours),
                startMinutes: Number(config.start_minutes),
                endMinutes: Number(config.end_minutes)
            },
            entries
        });
    } catch (err) {
        console.error('Erreur getWeeklyPlanner:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

const saveWeeklyPlanner = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = Number(req.user.id);
        const parsedConfig = sanitizeConfig(req.body || {});
        if (parsedConfig.error) {
            return res.status(400).json({ error: parsedConfig.error });
        }

        const entries = normalizeEntries(req.body?.entries);

        await client.query('BEGIN');

        await client.query(
            `INSERT INTO weekly_planner_config (user_id, block_size_hours, start_minutes, end_minutes, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET block_size_hours = EXCLUDED.block_size_hours,
                           start_minutes = EXCLUDED.start_minutes,
                           end_minutes = EXCLUDED.end_minutes,
                           updated_at = NOW()`,
            [userId, parsedConfig.blockSizeHours, parsedConfig.startMinutes, parsedConfig.endMinutes]
        );

        await client.query('DELETE FROM weekly_planner_entry WHERE user_id = $1', [userId]);

        for (const entry of entries) {
            await client.query(
                `INSERT INTO weekly_planner_entry
                 (user_id, day_index, slot_key, title, details, updated_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [userId, entry.dayIndex, entry.slotKey, entry.title, entry.details]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Planner sauvegardé', entriesCount: entries.length });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur saveWeeklyPlanner:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    } finally {
        client.release();
    }
};

module.exports = {
    getWeeklyPlanner,
    saveWeeklyPlanner
};
