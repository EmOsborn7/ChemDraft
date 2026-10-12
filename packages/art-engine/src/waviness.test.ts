import { describe, expect, it } from "vitest";
import type { GraphicObject } from "@chemdraft/chem-core";
import { planNativeArtVisual,editWavyLineAppearance,graphicPathVisualEditPoints } from "./index";

const wave:GraphicObject={id:"wave",type:"graphic",graphicKind:"path",x:0,y:0,width:116,height:60,
  rotation:0,style:{strokeWidth:2,strokeColor:"#111111"},
  data:{artPathKind:"wavy",lineStart:{x:10,y:30},lineEnd:{x:106,y:30}}};
const path=(smoothness:number)=>planNativeArtVisual({...wave,data:{...wave.data,waveSmoothness:smoothness}}).pathD!;
describe("adjustable wave rendering",()=>{
  it("sharpens and rounds the same wave without moving its endpoints or peaks",()=>{
    const sharp=path(0),half=path(0.5),smooth=path(1);
    expect(sharp).not.toContain("Q");expect(half).toContain("L");expect(half).toContain("Q");
    expect(smooth).not.toContain("L");expect(smooth).toContain("Q");
    for (const p of [sharp,half,smooth]) {
      expect(p).toMatch(/^M 10 30 /);expect(p).toMatch(/106 30$/);
      expect(p).not.toMatch(/NaN|Infinity/);
    }
    expect(sharp).toContain("L 12 33.2");
    // The full rounding quadratic starts/ends on the baseline; its midpoint stays at amplitude 3.2.
    expect(smooth).toMatch(/^M 10 30 Q 12 36.4 14 30/);
    expect((30+2*36.4+30)/4).toBeCloseTo(33.2);
  });
  it("uses the same adjusted shaft for arrowhead sampling on click-placed lines",()=>{
    for (const waveSmoothness of [0,0.5,1]) {
      const object={...wave,width:200,height:60,data:{artPathKind:"wavy",waveSmoothness,
        markerEnd:{kind:"filled-arrow",sizePx:12}}} satisfies GraphicObject;
      const plan=planNativeArtVisual(object,{coordinateSpace:"local"});
      expect(plan.pathD).toBeDefined();expect(plan.visiblePathD).toBeDefined();
      expect(plan.markerEndTerminal?.point.x).toBeGreaterThan(190);
      expect(plan.markerEndTerminal?.point.y).toBeCloseTo(30);
    }
  });
  it("keeps legacy geometry unchanged until a smoothness is explicitly stored",()=>{
    expect(planNativeArtVisual(wave).pathD).not.toContain("Q");
    const clicked={...wave,data:{artPathKind:"wavy"}} satisfies GraphicObject;
    expect(planNativeArtVisual(clicked).pathD).toContain("C");
    expect(planNativeArtVisual(clicked).pathD).not.toEqual(planNativeArtVisual({...clicked,data:{...clicked.data,waveSmoothness:1}}).pathD);
  });
  it("handles vertical, diagonal and very short waves with finite coordinates",()=>{
    for (const end of [{x:10,y:130},{x:70,y:90},{x:10.1,y:30.1}]) {
      const plan=planNativeArtVisual({...wave,data:{...wave.data,lineEnd:end,waveSmoothness:0.7}});
      expect(plan.pathD).not.toMatch(/NaN|Infinity/);expect(plan.pathD).toMatch(/^M 10 30 /);
    }
  });
  it("changes amplitude without shifting a rotated shaft and encloses tall peaks",()=>{
    const rotated={...wave,rotation:35,data:{...wave.data,waveSmoothness:1}};
    const original=graphicPathVisualEditPoints(rotated)!;
    for(const amplitudePx of [0,20,40]) {
      const changed=editWavyLineAppearance(rotated,{amplitudePx})!;
      const endpoints=graphicPathVisualEditPoints(changed)!;
      expect(endpoints.start.x).toBeCloseTo(original.start.x);expect(endpoints.start.y).toBeCloseTo(original.start.y);
      expect(endpoints.end.x).toBeCloseTo(original.end.x);expect(endpoints.end.y).toBeCloseTo(original.end.y);
      expect(changed.y).toBeLessThanOrEqual(30-amplitudePx);
      expect(changed.y+changed.height).toBeGreaterThanOrEqual(30+amplitudePx);
      expect(planNativeArtVisual(changed).pathD).toMatch(new RegExp(`^M 10 30 Q 12 ${30+2*amplitudePx} 14 30`));
      expect(changed.data.waveSmoothness).toBe(1);expect(changed.style).toEqual(wave.style);
    }
  });
  it("fits the requested number of complete waves without changing amplitude or endpoints",()=>{
    const original={...wave,data:{...wave.data,waveSmoothness:1,waveAmplitudePx:12}};
    for(const cycles of [1,4,12,512]) {
      const adjusted=editWavyLineAppearance(original,{cycles})!;
      const d=planNativeArtVisual(adjusted).pathD!;
      expect(d.match(/ Q /g)).toHaveLength(cycles*2);
      expect(d).toMatch(/^M 10 30 /);expect(d).toMatch(/106 30$/);
      expect(adjusted.data).toMatchObject({waveSmoothness:1,waveAmplitudePx:12,waveCycles:cycles});
      expect({...adjusted,data:original.data}).toEqual(original);
      expect(d).not.toMatch(/NaN|Infinity/);
    }
  });
});
