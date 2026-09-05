import Fastify from 'fastify'; import cors from '@fastify/cors'; import cookie from '@fastify/cookie'; import {z} from 'zod';
import { closeDb } from '@cacsms/database';
import {findUserByEmail,listMemberships,listRoles,listUsers,touchLogin,writeAudit,getCommandCenter,listProjectStages,controlProject,listMyWork,updateWorkItem,listNotifications,markNotification} from './repository.js'; import {requireSession,signSession,verifyPassword} from './auth.js';
const app=Fastify({logger:true}); await app.register(cors,{origin:process.env.APP_URL||'http://localhost:3000',credentials:true}); await app.register(cookie);
app.setErrorHandler((err: any, req, reply) => {
  const code = err.statusCode || err.code || 400;
  req.log.error(err);
  reply.code(Number(code) || 500).send({ error: code >= 500 ? 'Internal server error' : err.message });
});
app.get('/health',async()=>({status:'ok',service:'cacsms-cinema-api',version:'0.3.0',module01:'ready',module02:'ready'}));
app.post('/api/auth/login',async(req,reply)=>{const body=z.object({email:z.string().email(),password:z.string().min(8)}).parse(req.body);const user=await findUserByEmail(body.email);if(!user||!user.IsActive||!user.PasswordHash||!(await verifyPassword(body.password,user.PasswordHash))) return reply.code(401).send({error:'Invalid email or password'});const memberships=await listMemberships(user.UserId);await touchLogin(user.UserId);await writeAudit(user.UserId,null,'AUTH_LOGIN','User',JSON.stringify({email:user.Email}));const token=signSession({sub:user.UserId,email:user.Email});reply.setCookie('cacsms_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*8});return {user:{id:user.UserId,email:user.Email,name:user.DisplayName,mfaEnabled:user.MfaEnabled},workspaces:memberships}});
app.post('/api/auth/logout',async(req,reply)=>{reply.clearCookie('cacsms_session',{path:'/'});return {ok:true}});
app.get('/api/auth/me',async(req)=>{const session=requireSession(req);const user=await findUserByEmail(session.email);if(!user) throw Object.assign(new Error('User not found'),{statusCode:404});return {id:user.UserId,email:user.Email,name:user.DisplayName,mfaEnabled:user.MfaEnabled,lastLoginAt:user.LastLoginAt}});
app.get('/api/workspaces',async(req)=>{const s=requireSession(req);return {items:await listMemberships(s.sub)}});
app.post('/api/workspaces/select',async(req,reply)=>{const s=requireSession(req);const body=z.object({workspaceId:z.string().uuid()}).parse(req.body);const memberships=await listMemberships(s.sub);const m=memberships.find((x:any)=>x.WorkspaceId===body.workspaceId);if(!m) throw Object.assign(new Error('Workspace access denied'),{statusCode:403});const token=signSession({...s,workspaceId:m.WorkspaceId,role:m.RoleName});reply.setCookie('cacsms_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*8});await writeAudit(s.sub,m.WorkspaceId,'WORKSPACE_SELECTED','Workspace',JSON.stringify({role:m.RoleName}));return {ok:true,workspace:m}});
app.get('/api/admin/users',async(req)=>{const s=requireSession(req);if(!s.workspaceId) throw Object.assign(new Error('Select a workspace first'),{statusCode:409});return {items:await listUsers(s.workspaceId)}});
app.get('/api/admin/roles',async(req)=>{requireSession(req);return {items:await listRoles()}});
app.post('/api/auth/forgot-password',async(req)=>{z.object({email:z.string().email()}).parse(req.body);return {ok:true,message:'If an active account exists, recovery instructions will be issued.'}});
app.post('/api/auth/reset-password',async(req)=>{z.object({token:z.string().min(16),password:z.string().min(12)}).parse(req.body);return {ok:true,message:'Reset token accepted by contract; persistence hook is ready for email provider integration.'}});

app.get('/api/command-center',async(req)=>{const s=requireSession(req);if(!s.workspaceId)throw Object.assign(new Error('Select a workspace first'),{statusCode:409});return await getCommandCenter(s.workspaceId,s.sub)});
app.get('/api/command-center/projects/:projectId/stages',async(req)=>{const s=requireSession(req);if(!s.workspaceId)throw Object.assign(new Error('Select a workspace first'),{statusCode:409});const p=z.object({projectId:z.string().uuid()}).parse(req.params);return {items:await listProjectStages(s.workspaceId,p.projectId)}});
app.post('/api/command-center/projects/:projectId/control',async(req)=>{const s=requireSession(req);if(!s.workspaceId)throw Object.assign(new Error('Select a workspace first'),{statusCode:409});const p=z.object({projectId:z.string().uuid()}).parse(req.params);const body=z.object({action:z.enum(['START','PAUSE','RESUME','STOP','RESTART']),reason:z.string().max(1000).optional()}).parse(req.body);const result=await controlProject(s.workspaceId,p.projectId,s.sub,body.action,body.reason);await writeAudit(s.sub,s.workspaceId,`PROJECT_${body.action}`,'ContentProject',JSON.stringify({projectId:p.projectId,reason:body.reason||null}));return result});
app.get('/api/my-work',async(req)=>{const s=requireSession(req);if(!s.workspaceId)throw Object.assign(new Error('Select a workspace first'),{statusCode:409});return {items:await listMyWork(s.workspaceId,s.sub)}});
app.patch('/api/my-work/:workItemId',async(req)=>{const s=requireSession(req);if(!s.workspaceId)throw Object.assign(new Error('Select a workspace first'),{statusCode:409});const p=z.object({workItemId:z.string().uuid()}).parse(req.params);const body=z.object({status:z.enum(['OPEN','IN_PROGRESS','WAITING','COMPLETED','CANCELLED'])}).parse(req.body);const item=await updateWorkItem(s.workspaceId,s.sub,p.workItemId,body.status);if(!item)throw Object.assign(new Error('Work item not found'),{statusCode:404});return item});
app.get('/api/notifications',async(req)=>{const s=requireSession(req);if(!s.workspaceId)throw Object.assign(new Error('Select a workspace first'),{statusCode:409});return {items:await listNotifications(s.workspaceId,s.sub)}});
app.patch('/api/notifications/:notificationId',async(req)=>{const s=requireSession(req);const p=z.object({notificationId:z.string().uuid()}).parse(req.params);const body=z.object({read:z.boolean()}).parse(req.body);const item=await markNotification(s.sub,p.notificationId,body.read);if(!item)throw Object.assign(new Error('Notification not found'),{statusCode:404});return item});

async function shutdown(signal: string, code: number): Promise<void> {
  app.log.info(`${signal} received, shutting down gracefully...`);
  try {
    await app.close();
  } catch (error) {
    app.log.error(error, 'Error closing Fastify server');
  }
  try {
    await closeDb();
  } catch (error) {
    app.log.error(error, 'Error closing database pool');
  }
  process.exit(code);
}

process.on('SIGINT', () => void shutdown('SIGINT', 0));
process.on('SIGTERM', () => void shutdown('SIGTERM', 0));

const port=Number(process.env.API_PORT??4000);const host=process.env.API_HOST??'0.0.0.0';app.listen({port,host}).catch(e=>{app.log.error(e);void closeDb().finally(()=>process.exit(1))});
