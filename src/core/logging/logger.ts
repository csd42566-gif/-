import { redact } from './redaction';
export type LogLevel='debug'|'info'|'warn'|'error';
export interface LogEntry{at:string;level:LogLevel;event:string;message:string}
export class AppLogger{private entries:LogEntry[]=[];log(level:LogLevel,event:string,message:string){this.entries.unshift({at:new Date().toISOString(),level,event,message:redact(message)});this.entries=this.entries.slice(0,100);}getEntries(){return [...this.entries];}clear(){this.entries=[];}}
export const logger=new AppLogger();
