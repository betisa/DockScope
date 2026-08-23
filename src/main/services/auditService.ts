import { dialog } from 'electron'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dockerService } from './dockerService'
import { run } from './processRunner'
import type { AuditEntry, AuditExportResult, AuditSeverity, AuditSummary, CommandResult, ComposeProject, RecoverySnapshot } from '../../shared/contracts'
import { databaseService } from '../database/database'
import { importLegacyJson } from '../database/legacyImport'

export function maskKey(key: string) { return /(password|secret|token|api[_-]?key|connection|credential|private[_-]?key)/i.test(key) }
export function maskEnv(values: string[]) {
  return values.map(x => { const i=x.indexOf('='); if(i<0)return x; const k=x.slice(0,i); return maskKey(k)?`${k}=••••••••`:x })
}
function humanBytes(bytes: number) {
  const units=['B','KB','MB','GB','TB']; let n=Math.max(0,bytes),i=0
  while(n>=1024&&i<units.length-1){n/=1024;i++}
  return `${n.toFixed(i>=3?2:1)} ${units[i]}`
}
export function parseBytes(text: string) {
  const m=(text||'').match(/([\d.]+)\s*([kmgt]?i?b)/i); if(!m)return 0
  const n=Number(m[1]); const u=m[2].toLowerCase(); const map:Record<string,number>={b:1,kb:1000,mb:1000**2,gb:1000**3,tb:1000**4,kib:1024,mib:1024**2,gib:1024**3,tib:1024**4}
  return n*(map[u]??1)
}

class AuditService {
  private entries: AuditEntry[]=[]
  private snaps: RecoverySnapshot[]=[]
  private loaded=false

  async initialize(){
    if(this.loaded)return
    await databaseService.initialize()

    await importLegacyJson<AuditEntry[]>('audit-history.json', async legacy => {
      const rows = Array.isArray(legacy) ? legacy : []
      if (rows.length) {
        await databaseService.db.transaction(async trx => {
          for (const entry of rows) {
            await trx('audit_entries').insert({
              id: entry.id,
              completed_at: entry.completedAt || entry.startedAt || new Date().toISOString(),
              severity: entry.severity,
              status: entry.status,
              payload: JSON.stringify(entry)
            }).onConflict('id').ignore()
          }
        })
      }
      return rows.length
    })

    await importLegacyJson<RecoverySnapshot[]>('recovery-snapshots.json', async legacy => {
      const rows = Array.isArray(legacy) ? legacy : []
      if (rows.length) {
        await databaseService.db.transaction(async trx => {
          for (const snapshot of rows) {
            await trx('recovery_snapshots').insert({
              id: snapshot.id,
              created_at: snapshot.createdAt,
              resource_type: snapshot.resourceType,
              resource_id: snapshot.resourceId,
              payload: JSON.stringify(snapshot)
            }).onConflict('id').ignore()
          }
        })
      }
      return rows.length
    })

    await this.loadEntries()
    await this.loadSnapshots()
    this.loaded=true
  }

  private async loadEntries(){
    const rows = await databaseService.db('audit_entries').select('payload').orderBy('completed_at','desc')
    this.entries = rows.map(row => JSON.parse(row.payload) as AuditEntry)
  }

  private async loadSnapshots(){
    const rows = await databaseService.db('recovery_snapshots').select('payload').orderBy('created_at','desc')
    this.snaps = rows.map(row => JSON.parse(row.payload) as RecoverySnapshot)
  }

  private async save(){
    const entries = this.entries.slice(0,Number(process.env.DSM_AUDIT_RETENTION)||2000)
    const snapshots = this.snaps.slice(0,Number(process.env.DSM_SNAPSHOT_RETENTION)||1000)
    await databaseService.db.transaction(async trx => {
      await trx('audit_entries').delete()
      await trx('recovery_snapshots').delete()
      for (const entry of entries) {
        await trx('audit_entries').insert({
          id:entry.id,
          completed_at:entry.completedAt || entry.startedAt || new Date().toISOString(),
          severity:entry.severity,
          status:entry.status,
          payload:JSON.stringify(entry)
        })
      }
      for (const snapshot of snapshots) {
        await trx('recovery_snapshots').insert({
          id:snapshot.id,
          created_at:snapshot.createdAt,
          resource_type:snapshot.resourceType,
          resource_id:snapshot.resourceId,
          payload:JSON.stringify(snapshot)
        })
      }
    })
  }
  list(){return [...this.entries]}
  snapshots(){return [...this.snaps]}
  snapshot(id:string){return this.snaps.find(x=>x.id===id)??null}
  summary():AuditSummary{return{totalActions:this.entries.length,successfulActions:this.entries.filter(x=>x.status==='success').length,failedActions:this.entries.filter(x=>x.status==='failed').length,destructiveActions:this.entries.filter(x=>x.severity==='critical').length,recoverySnapshots:this.snaps.length,lastActionAt:this.entries[0]?.completedAt??''}}
  async clear(){this.entries=[];this.snaps=[];await this.save()}

  async addSnapshot(snapshot: Omit<RecoverySnapshot,'id'|'createdAt'>){ const row:RecoverySnapshot={...snapshot,id:randomUUID(),createdAt:new Date().toISOString()};this.snaps.unshift(row);await this.save();return row }

  async containerSnapshot(id:string){
    try{const d=await dockerService.diagnostics(id);return this.addSnapshot({resourceType:'container',resourceId:id,resourceName:d.name,data:{...d,environment:maskEnv(d.environment)},notes:['Environment values matching secret-like keys were masked.','This snapshot is metadata for manual recovery; it does not contain volume contents.']})}catch(error){return this.addSnapshot({resourceType:'container',resourceId:id,resourceName:id,data:{error:String(error)},notes:['Container metadata could not be fully captured.']})}
  }
  async composeSnapshot(p:ComposeProject){
    try{const w=await dockerService.composeWorkspace(p);return this.addSnapshot({resourceType:'compose',resourceId:p.name,resourceName:p.name,data:{configFiles:p.configFiles,services:w.services.map(s=>({...s,environment:Object.fromEntries(Object.entries(s.environment).map(([k,v])=>[k,maskKey(k)?'••••••••':v]))})),networks:w.networks,volumes:w.volumes},notes:['Resolved service environments were secret-masked.','Compose files remain the primary recovery source.']})}catch(error){return this.addSnapshot({resourceType:'compose',resourceId:p.name,resourceName:p.name,data:{configFiles:p.configFiles,error:String(error)},notes:['Compose workspace snapshot was partial.']})}
  }
  async imageSnapshot(id:string){
    try{const [images,history]=await Promise.all([dockerService.images(),dockerService.imageHistory(id)]);const img=images.find(x=>x.id===id)||images.find(x=>x.id.endsWith(id.replace('sha256:','')));return this.addSnapshot({resourceType:'image',resourceId:id,resourceName:img?`${img.repository}:${img.tag}`:id,data:{image:img??null,history},notes:['Image layer contents are not backed up; only metadata/history is recorded.']})}catch(error){return this.addSnapshot({resourceType:'image',resourceId:id,resourceName:id,data:{error:String(error)},notes:['Image metadata snapshot failed.']})}
  }
  async volumeSnapshot(name:string){
    const result=await run('docker',['volume','inspect',name]);let data:any={raw:result.stdout||result.stderr};try{data=JSON.parse(result.stdout)[0]}catch{}
    return this.addSnapshot({resourceType:'volume',resourceId:name,resourceName:name,data,notes:['Volume contents are NOT backed up. This snapshot records metadata only.','Deleting a volume may permanently destroy persistent data.']})
  }

  async record<T extends CommandResult | CommandResult[]>(options:{operation:string;category:string;severity:AuditSeverity;resourceType:string;resourceIds:string[];resourceNames?:string[];commandSummary:string;snapshotIds?:string[];beforeReclaimable?:string}, action:()=>Promise<T>):Promise<T>{
    const started=Date.now(),startedAt=new Date(started).toISOString();let result:T|undefined;let errorMessage=''
    try{result=await action();return result} catch(error){errorMessage=error instanceof Error?error.message:String(error);throw error} finally {
      const completed=Date.now();const rows=Array.isArray(result)?result:result?[result]:[];const ok=Boolean(result)&&rows.every(x=>x.ok);const exitCode=rows.find(x=>!x.ok)?.exitCode??rows[0]?.exitCode
      let after=options.beforeReclaimable,delta=''
      if(options.beforeReclaimable){try{const usage=await dockerService.diskUsage();after=usage.map(x=>x.reclaimable).join(' · ')}catch{} }
      const message=errorMessage||rows.map(x=>x.stdout||x.stderr).filter(Boolean).join('\n').slice(0,1600)||'Operation completed.'
      const entry:AuditEntry={id:randomUUID(),operation:options.operation,category:options.category,severity:options.severity,status:ok?'success':'failed',startedAt,completedAt:new Date(completed).toISOString(),durationMs:completed-started,resourceType:options.resourceType,resourceIds:options.resourceIds,resourceNames:options.resourceNames??options.resourceIds,commandSummary:options.commandSummary,message,exitCode,reclaimedBefore:options.beforeReclaimable,reclaimedAfter:after,reclaimedDelta:delta,snapshotIds:options.snapshotIds??[]}
      this.entries.unshift(entry);this.entries=this.entries.slice(0,Number(process.env.DSM_AUDIT_RETENTION)||2000);await this.save()
    }
  }

  async exportReport():Promise<AuditExportResult>{
    const {canceled,filePath}=await dialog.showSaveDialog({title:'Export DockScope Audit Report',defaultPath:`dockscope-audit-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'JSON',extensions:['json']}]})
    if(canceled||!filePath)return{ok:false,message:'Export cancelled.'}
    const body={generatedAt:new Date().toISOString(),summary:this.summary(),entries:this.entries,snapshots:this.snaps}
    await fs.writeFile(filePath,JSON.stringify(body,null,2),'utf8');return{ok:true,path:filePath,message:'Audit report exported.'}
  }
}
export const auditService=new AuditService()
