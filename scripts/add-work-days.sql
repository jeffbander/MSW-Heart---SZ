-- Add work_days column to providers table
-- Values are JS day-of-week numbers: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
-- Default is Mon-Fri (full work week)
ALTER TABLE providers ADD COLUMN IF NOT EXISTS work_days INTEGER[] DEFAULT '{1,2,3,4,5}';
