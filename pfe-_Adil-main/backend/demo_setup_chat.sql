DO $$
DECLARE
  v_student_id INT;
  v_fg_id INT;
  v_conv_id INT;
BEGIN
  SELECT id INTO v_student_id FROM users WHERE email='demo.etudiant.simple@eduplatform.com' LIMIT 1;
  SELECT id INTO v_fg_id FROM users WHERE email='demo.formateur.global@eduplatform.com' LIMIT 1;

  IF v_student_id IS NULL OR v_fg_id IS NULL THEN
    RAISE EXCEPTION 'Demo users missing for chat';
  END IF;

  SELECT c.id INTO v_conv_id
  FROM conversations c
  JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = v_student_id AND cp1.left_at IS NULL
  JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = v_fg_id AND cp2.left_at IS NULL
  WHERE c.conversation_type='PRIVATE'
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO conversations (conversation_type, created_by)
    VALUES ('PRIVATE', v_student_id)
    RETURNING id INTO v_conv_id;
  END IF;

  INSERT INTO conversation_participants (conversation_id, user_id, role, left_at)
  VALUES (v_conv_id, v_student_id, 'OWNER', NULL)
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET left_at = NULL, role = 'OWNER';

  INSERT INTO conversation_participants (conversation_id, user_id, role, left_at)
  VALUES (v_conv_id, v_fg_id, 'MEMBER', NULL)
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET left_at = NULL, role = 'MEMBER';

  INSERT INTO messages (conversation_id, user_id, content, message_type)
  VALUES (v_conv_id, v_student_id, 'Bonjour professeur, j''ai poste mon TD et je vous demande validation svp.', 'TEXT');

  UPDATE conversations
  SET last_message = 'Bonjour professeur, j''ai poste mon TD et je vous demande validation svp.',
      last_message_by = v_student_id,
      last_message_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP,
      message_count = COALESCE(message_count, 0) + 1
  WHERE id = v_conv_id;
END $$;

SELECT c.id AS conversation_id, c.last_message, c.message_count
FROM conversations c
JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
WHERE c.conversation_type='PRIVATE'
  AND cp1.user_id = (SELECT id FROM users WHERE email='demo.etudiant.simple@eduplatform.com')
  AND cp2.user_id = (SELECT id FROM users WHERE email='demo.formateur.global@eduplatform.com')
LIMIT 1;
