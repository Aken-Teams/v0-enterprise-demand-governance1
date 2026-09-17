-- 為專案待辦加上「逾期說明」欄位
--
-- 僅內部可見：不進流程、不對需求方與 Scrum Master 開放。
-- 純新增欄位且可為 NULL，既有資料不受影響。

ALTER TABLE `demand_todos` ADD COLUMN `overdueNote` TEXT NULL;
