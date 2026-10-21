import { expect,test } from 'bun:test';
import { supportAvailability } from '../../../src/models/services/supportService';
test('support defaults On',()=>expect(supportAvailability(null)).toEqual({mode:'on',away_until:null}));
test('Off remains Off',()=>expect(supportAvailability({mode:'off',away_until:'2026-11-03'})).toEqual({mode:'off',away_until:null}));
test('Away lasts through selected UTC date and returns On afterward',()=>{
 const s={mode:'away',away_until:'2026-11-03'};
 expect(supportAvailability(s,Date.parse('2026-11-03T23:59:59Z'))).toEqual(s);
 expect(supportAvailability(s,Date.parse('2026-11-04T00:00:00Z'))).toEqual({mode:'on',away_until:null});
});