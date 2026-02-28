-- ============================================================
-- DAILFOW — Migration v2 : scheduled_slots amélioré
-- À exécuter dans phpMyAdmin (base de données: dailfow)
-- ============================================================

USE dailfow;

-- 1. Rendre task_id nullable (pour les pauses sans tâche liée)
ALTER TABLE scheduled_slots
  MODIFY COLUMN task_id INT NULL;

-- 2. Ajouter la colonne source (manual | ai | auto)
ALTER TABLE scheduled_slots
  ADD COLUMN IF NOT EXISTS source ENUM('manual', 'ai', 'auto') NOT NULL DEFAULT 'manual'
  AFTER ai_generated;

-- 3. Ajouter la colonne notification_sent (pour les rappels de début de tâche)
ALTER TABLE scheduled_slots
  ADD COLUMN IF NOT EXISTS notification_sent TINYINT(1) NOT NULL DEFAULT 0
  AFTER source;

-- 4. Mettre à jour les slots existants : ai_generated=1 → source='ai'
UPDATE scheduled_slots SET source = 'ai' WHERE ai_generated = 1;
UPDATE scheduled_slots SET source = 'manual' WHERE ai_generated = 0 AND source = 'manual';

-- 5. Vérification : afficher la structure finale
DESCRIBE scheduled_slots;

-- ============================================================
-- Résultat attendu :
--   id              int, PK
--   user_id         int, NOT NULL
--   task_id         int, NULL  ← nullable pour les pauses
--   start_at        datetime, NOT NULL
--   end_at          datetime, NOT NULL
--   is_break        tinyint(1)
--   ai_generated    tinyint(1)
--   source          enum('manual','ai','auto') DEFAULT 'manual'
--   notification_sent tinyint(1) DEFAULT 0
--   created_at      datetime
-- ============================================================
