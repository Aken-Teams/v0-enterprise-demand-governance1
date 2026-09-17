-- 專案內部待辦（團隊自我管理用的記事本）
--
-- 一張需求一份 Markdown 筆記。與流程完全脫鉤：不是簽核、不是卡點、不指派給人，
-- 也不對需求方與 Scrum Master 開放（權限在 API 層把關）。
--
-- 執行前請先備份。此腳本只新增一張表，不修改既有資料。

CREATE TABLE `demand_todos` (
  `id`            VARCHAR(191) NOT NULL,
  `demandId`      VARCHAR(191) NOT NULL,
  `content`       TEXT NOT NULL,
  `updatedById`   VARCHAR(191) NULL,
  `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `demand_todos_demandId_key` (`demandId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 需求刪除時一併移除筆記
ALTER TABLE `demand_todos`
  ADD CONSTRAINT `demand_todos_demandId_fkey`
  FOREIGN KEY (`demandId`) REFERENCES `demands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 最後編輯者；使用者被刪除時保留筆記、僅清空關聯
ALTER TABLE `demand_todos`
  ADD CONSTRAINT `demand_todos_updatedById_fkey`
  FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
