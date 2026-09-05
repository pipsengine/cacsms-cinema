import jwt from 'jsonwebtoken'; import bcrypt from 'bcryptjs'; import type { FastifyRequest } from 'fastify';
const secret=()=>process.env.JWT_SECRET||'development-only-change-me';
export type SessionClaims={sub:string;email:string;workspaceId?:string;role?:string};
export const hashPassword=(v:string)=>bcrypt.hash(v,12);
export const verifyPassword=(v:string,h:string)=>bcrypt.compare(v,h);
export const signSession=(claims:SessionClaims)=>jwt.sign({sub:claims.sub,email:claims.email,workspaceId:claims.workspaceId,role:claims.role},secret(),{expiresIn:'8h',issuer:'cacsms-cinema'});
export const readSession=(token:string)=>{const raw=jwt.verify(token,secret(),{issuer:'cacsms-cinema'}) as SessionClaims & {exp?:number;iat?:number};return {sub:raw.sub,email:raw.email,workspaceId:raw.workspaceId,role:raw.role} as SessionClaims};
export function requireSession(req:FastifyRequest){const token=req.cookies.cacsms_session||req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token) throw Object.assign(new Error('Authentication required'),{statusCode:401}); return readSession(token)}
