/** Slug used for module-linked communities (must match adminService.assignFormateurToModule). */
function slugFromModuleCode(code) {
  return `${String(code).toLowerCase().replace(/[^a-z0-9-]/g, '-')}-community`;
}

function findModuleRowForCommunitySlug(slug, moduleRows) {
  for (const m of moduleRows) {
    if (slugFromModuleCode(m.code) === slug) return m;
  }
  return null;
}

module.exports = { slugFromModuleCode, findModuleRowForCommunitySlug };
