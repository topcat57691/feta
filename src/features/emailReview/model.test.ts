import { describe, expect, it } from 'vitest';
import { allowedSender, parseExtraction, validDate, validTime } from './model';
describe('school email review',()=>{
  it('matches domains exactly and scopes council mail',()=>{
    expect(allowedSender('Info@AbbeyFarmET.org.uk','Newsletter')).toBe(true);
    expect(allowedSender('noreply@tapestryjournal.com','Observation')).toBe(true);
    expect(allowedSender('notification@arbor-education.com','Parent evening')).toBe(true);
    expect(allowedSender('info@abbeyfarmet.org.uk.bad.example','Newsletter')).toBe(false);
    expect(allowedSender('noreply@swindon.gov.uk','Council tax')).toBe(false);
    expect(allowedSender('noreply@swindon.gov.uk','School admissions')).toBe(true);
  });
  it('excludes authentication emails',()=>{
    expect(allowedSender('password-reset@arbor-education.com','Change your Arbor password')).toBe(false);
    expect(allowedSender('noreply@tapestryjournal.com','Create your Abbey Farm login')).toBe(false);
    expect(allowedSender('info@abbeyfarmet.org.uk','Notice','Your verification code')).toBe(false);
  });
  it('validates dates and times',()=>{
    expect(validDate('2026-02-29')).toBe(false);
    expect(validDate('2028-02-29')).toBe(true);
    expect(validTime('24:00')).toBe(false);
    expect(validTime('09:15')).toBe(true);
  });
  it('requires structured AI results and never invents dates or times',()=>{
    const parsed=parseExtraction({summary:'Upcoming trip',suggestions:[
      {kind:'event',title:'Trip',date:'2026-12-03',time:'bogus',endTime:'17:00'},
      {kind:'event',title:'Unconfirmed event',date:'2026-02-30'},
      {kind:'unsupported',title:'Invalid'},
    ]});
    expect(parsed.suggestions).toHaveLength(2);
    expect(parsed.suggestions[0]).toMatchObject({kind:'event',date:'2026-12-03',time:null,endTime:null,status:'pending'});
    expect(parsed.suggestions[1]).toMatchObject({kind:'task',date:null});
    expect(()=>parseExtraction({summary:'missing suggestions'})).toThrow();
  });
  it('removes URLs from output',()=>{
    expect(parseExtraction({summary:'Visit https://example.com/private',suggestions:[]}).summary).not.toContain('https://');
  });
});
