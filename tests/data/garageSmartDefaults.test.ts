import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
test('existing garages stay Smart off while new garage inserts default on at 40 GB',()=>{
 const sql=readFileSync(new URL('../../drizzle/migrations/0055_garage_smart_settings.sql',import.meta.url),'utf8');
 const add=sql.indexOf('ADD COLUMN smart boolean NOT NULL DEFAULT false');
 const future=sql.indexOf('ALTER COLUMN smart SET DEFAULT true');
 expect(add).toBeGreaterThanOrEqual(0); expect(future).toBeGreaterThan(add);
 expect(sql).toContain('smart_disk_gb numeric NOT NULL DEFAULT 40');
});