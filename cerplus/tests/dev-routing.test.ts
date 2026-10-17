import test from 'node:test';
import assert from 'node:assert/strict';
import { cerplusApiUrl } from '../../src/scripts/cerplus-api.ts';

test('API URLs meet Astro trailing-slash policy and keep filters after the slash',()=>{
  assert.equal(cerplusApiUrl('/login'),'/cerplus/api/login/');
  assert.equal(cerplusApiUrl('/bootstrap'),'/cerplus/api/bootstrap/');
  assert.equal(cerplusApiUrl('/stock?search=15-01&owner=common'),'/cerplus/api/stock/?search=15-01&owner=common');
  assert.equal(cerplusApiUrl('/imports/catalog/template'),'/cerplus/api/imports/catalog/template/');
  assert.equal(cerplusApiUrl('/login/'),'/cerplus/api/login/');
});
