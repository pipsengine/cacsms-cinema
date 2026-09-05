export type UserStatus = 'Active' | 'Invited' | 'Suspended';
export const workspaces = [
  { id:'ws-1', name:'Cacsms Cinema', code:'CAC', role:'Super Admin', members:8, projects:24, plan:'Production', last:'Just now' },
  { id:'ws-2', name:'Cacsms TV Content Lab', code:'CTV', role:'Content Manager', members:5, projects:12, plan:'Creator', last:'2 days ago' }
];
export const permissions = [
  ['workspace.view','View workspace'],['workspace.manage','Manage workspace settings'],['users.view','View users'],['users.manage','Create, edit and suspend users'],['roles.manage','Manage roles and permissions'],['content.view','View content projects'],['content.create','Create content projects'],['content.approve','Approve workflow stages'],['agents.manage','Manage AI agents'],['integrations.manage','Manage provider integrations'],['billing.view','View usage and cost'],['audit.view','View audit trail']
] as const;
export const roles = [
  { name:'Super Admin', desc:'Full platform administration and unrestricted workspace access.', users:1, system:true, permissions:permissions.map(p=>p[0]) },
  { name:'Content Manager', desc:'Runs content operations, assignments and approval gates.', users:2, system:true, permissions:['workspace.view','users.view','content.view','content.create','content.approve','billing.view'] },
  { name:'Reviewer', desc:'Reviews assigned scripts, assets and release packages.', users:2, system:true, permissions:['workspace.view','content.view','content.approve'] },
  { name:'Creator', desc:'Creates and edits content through assigned production stages.', users:2, system:true, permissions:['workspace.view','content.view','content.create'] },
  { name:'Viewer', desc:'Read-only access to approved operational information.', users:1, system:true, permissions:['workspace.view','content.view'] }
];
export const users = [
  { name:'Pips Engine', email:'pipsengine@gmail.com', initials:'PE', role:'Super Admin', status:'Active' as UserStatus, workspace:'Cacsms Cinema', last:'Today, 4:31 PM', mfa:true },
  { name:'Amara Okafor', email:'amara@cacsms.local', initials:'AO', role:'Content Manager', status:'Active' as UserStatus, workspace:'Cacsms Cinema', last:'Today, 3:46 PM', mfa:true },
  { name:'Daniel Cole', email:'daniel@cacsms.local', initials:'DC', role:'Creator', status:'Active' as UserStatus, workspace:'Cacsms Cinema', last:'Today, 1:02 PM', mfa:false },
  { name:'Ada Eze', email:'ada@cacsms.local', initials:'AE', role:'Reviewer', status:'Invited' as UserStatus, workspace:'Cacsms Cinema', last:'Invitation pending', mfa:false },
  { name:'Michael James', email:'michael@cacsms.local', initials:'MJ', role:'Viewer', status:'Suspended' as UserStatus, workspace:'Cacsms Cinema', last:'Aug 29, 2026', mfa:true }
];