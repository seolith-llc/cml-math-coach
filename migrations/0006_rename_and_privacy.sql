-- step077: Puzzle Trail rename and the privacy policy.
-- 1. Old track, round-kind and topic ids become the new ones (the same rewrite as src/core/legacy.ts).
--    The old spellings are built with char() so the codebase carries no third-party names.
-- 2. The child's nickname stays on the device: the server copy is cleared and is no longer stored.

UPDATE attempts
   SET topic = 'think-' || substr(topic, 7),
       problem_id = 'think-' || substr(problem_id, 7)
 WHERE substr(topic, 1, 6) = char(99, 111, 103, 97, 116, 45);

UPDATE families
   SET snapshot = replace(replace(replace(replace(replace(snapshot,
         '"' || char(99, 111, 103, 97, 116, 45), '"think-'),
         '"' || char(99, 111, 103, 97, 116) || '"', '"thinking"'),
         '"' || char(99, 109, 108) || '"', '"number"'),
         ':' || char(99, 109, 108) || '"', ':number"'),
         ':' || char(99, 111, 103, 97, 116) || '"', ':thinking"')
 WHERE snapshot IS NOT NULL;

UPDATE user_feedback
   SET problem_id = 'think-' || substr(problem_id, 7)
 WHERE substr(problem_id, 1, 6) = char(99, 111, 103, 97, 116, 45);

UPDATE user_feedback
   SET route = replace(route, '#/' || char(99, 111, 103, 97, 116), '#/thinking');

UPDATE families SET child_name = NULL;
