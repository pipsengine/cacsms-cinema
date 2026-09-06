import Link from 'next/link';
const tabs=[['Overview','/admin/operations'],['Agents','/admin/agents'],['Workflow','/admin/workflows'],['Integrations','/admin/integrations'],['Usage & Cost','/admin/costs'],['Assets','/admin/assets'],['Audit','/admin/audit'],['Notifications','/admin/notification-rules'],['Security','/admin/security'],['Backup','/admin/backup'],['Health','/admin/health'],['Settings','/admin/settings']];
export function AdminTabs(){return <div className="stage-tabs admin-tabs">{tabs.map(([l,h])=><Link key={h} href={h}>{l}</Link>)}</div>}
