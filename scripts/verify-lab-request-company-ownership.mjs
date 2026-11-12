import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=readFileSync(path.join(root,'supabase/functions/lab-account-create-testing-order/index.ts'),'utf8');
const a=server.indexOf('if(action==="create"){');
const z=server.indexOf('if(action==="passes"){',a);
assert.ok(a>=0&&z>a,'lab testing create handler exists');
const create=server.slice(a,z);
const checks=[
 ['verified signed-in account',server.includes('auth.auth.getUser(token)')&&server.includes('email_confirmed_at')],
 ['existing Lab entitlement check',server.includes('grant.authorized!==true')],
 ['active completed purchase intake',create.includes('.eq("account_status","active").eq("status","completed")')],
 ['paid order verification',create.includes('o.payment_status==="paid"')],
 ['requires active company grant',create.includes('.eq("entitlement_code","lab_account").eq("status","active")')],
 ['grant restricted to signed-in customer',create.includes('.eq("linked_customer_user_id",user.id)')],
 ['grant tied to verified paid order',create.includes('.in("source_order_id",eligibleOrders)')],
 ['requires unambiguous company',create.includes('entitlements.data?.length!==1')],
 ['requires active organization membership',create.includes('.eq("organization_id",linked.organization_id).eq("user_id",user.id)')&&create.includes('.eq("status","active").limit(1)')],
 ['C/TPA identity matches grant company',create.includes('.eq("id",linked.ctpa_id).eq("organization_id",linked.organization_id)')],
 ['new cases carry verified C/TPA and org IDs',create.includes('ctpa_id:ctpa.data.id,organization_id:ctpa.data.organization_id')],
 ['no organization selection by email',!create.includes('organizations").select("id").ilike("primary_email"')],
 ['preserves existing case fulfillment state',create.includes('status:"awaiting_schedule"')],
 ['does not issue donor pass automatically',create.includes('donor_pass:"not_issued"')],
 ['does not submit labcorp request automatically',create.includes('labcorp_submission:"not_submitted"')]
];
for(const [label,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${label}`);assert.ok(pass,label)}
console.log(`${checks.length}/${checks.length} company-ownership source assertions passed; authenticated integration tests still required`);
