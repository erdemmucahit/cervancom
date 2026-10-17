import { randomUUID } from 'node:crypto';
import { AppError, audit, decimal, one, quantity, textValue, uuid } from './types.ts';
import type { Connection } from './types.ts';

export interface PackageInput { sequence: number; total: number; required: number; barcode: string; volume: string; weight: string }
export interface ProductInput { brandId: string; code: string; model: string; variant: string; assemblyMinutes: number; packages: PackageInput[] }
export function normalizeProduct(body: any): ProductInput {
  if (!Array.isArray(body.packages) || body.packages.length<1 || body.packages.length>100) throw new AppError('Üründe 1–100 koli tipi olmalı.');
  const packages = body.packages.map((item: any): PackageInput => ({
    sequence:quantity(item.sequence,'Koli sırası',100), total:body.packages.length,
    required:quantity(item.required,'Gereken adet',100), barcode:textValue(item.barcode,'Barkod',120),
    volume:decimal(item.volume,'Hacim (m³)'), weight:decimal(item.weight,'Ağırlık (kg)'),
  })).sort((a: PackageInput,b: PackageInput) => a.sequence-b.sequence);
  if (packages.some((item: PackageInput,i: number) => item.sequence !== i+1)) throw new AppError('Koli sıraları 1’den başlayarak eksiksiz ve tekil olmalı.');
  if (new Set(packages.map((item: PackageInput) => item.barcode)).size !== packages.length) throw new AppError('Aynı üründe barkodlar farklı olmalı.');
  const assembly = Number(body.assemblyMinutes ?? 0);
  if (!Number.isInteger(assembly) || assembly<0 || assembly>1440) throw new AppError('Montaj süresi 0–1440 dakika olmalı.');
  return { brandId:uuid(body.brandId,'Marka'), code:textValue(body.code,'Ürün kodu',80), model:textValue(body.model,'Model'),
    variant:body.variant ? textValue(body.variant,'Varyant',100) : '', assemblyMinutes:assembly, packages };
}
export async function insertProduct(tx: Connection, actor: string, product: ProductInput) {
  await one(tx,'SELECT id FROM brands WHERE id=$1',[product.brandId]);
  const id = randomUUID();
  await tx.query('INSERT INTO products(id,brand_id,code,model,variant,assembly_minutes) VALUES($1,$2,$3,$4,$5,$6)',[id,product.brandId,product.code,product.model,product.variant,product.assemblyMinutes]);
  for (const item of product.packages) {
    await tx.query(`INSERT INTO package_types(id,product_id,brand_id,sequence,total,required_quantity,barcode,volume_m3,weight_kg)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[randomUUID(),id,product.brandId,item.sequence,item.total,item.required,item.barcode,item.volume,item.weight]);
  }
  await audit(tx,actor,'catalog.create',id,null,product);
  return { id };
}
export async function listCatalog(tx: Connection, search = '') {
  return (await tx.query(`SELECT p.*, b.name AS brand,
    (SELECT jsonb_agg(jsonb_build_object('id',k.id,'sequence',k.sequence,'total',k.total,'required',k.required_quantity,'barcode',k.barcode,'volume',k.volume_m3::text,'weight',k.weight_kg::text) ORDER BY k.sequence)
     FROM package_types k WHERE k.product_id=p.id) AS packages
    FROM products p JOIN brands b ON b.id=p.brand_id
    WHERE p.code ILIKE $1 OR p.model ILIKE $1 OR b.name ILIKE $1 ORDER BY b.name,p.code,p.variant LIMIT 200`,[`%${search.slice(0,100)}%`])).rows;
}
export async function lookupBarcode(tx: Connection, barcode: string, brandId?: string) {
  return (await tx.query(`SELECT k.id,k.barcode,k.sequence,k.total,k.required_quantity,p.code,p.model,p.variant,b.name AS brand,b.id AS brand_id
    FROM package_types k JOIN products p ON p.id=k.product_id JOIN brands b ON b.id=k.brand_id
    WHERE k.barcode=$1 AND ($2::uuid IS NULL OR k.brand_id=$2) ORDER BY b.name`,[textValue(barcode,'Barkod',120),brandId ? uuid(brandId) : null])).rows;
}

// A full product always consumes every required package type. Never sum boxes.
export function fullProductCount(required: { id: string; quantity: number }[], available: Record<string,number>): number {
  if (!required.length) return 0;
  return Math.min(...required.map(item => Math.floor((available[item.id] ?? 0)/item.quantity)));
}
export function eligibleOwner(stockOwner: string, dealerId: string) {
  return stockOwner==='common' || stockOwner===dealerId;
}
