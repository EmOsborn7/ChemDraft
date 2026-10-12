import { describe, expect, it } from "vitest";
import { applyPatches, type GraphicObject } from "@chemdraft/chem-core";
import { planNativeArtVisual } from "@chemdraft/art-engine";
import { exportDocumentToSvg } from "@chemdraft/export-engine";
import { createLayerActions } from "./commands";
import { applyNativeArtLineToolAtPoint,createPhase4Document,createNativeSavePayload,openNativeDocument,
  setWavyLineSmoothness,setWavyLineSettings,wavyLineForAdjustment,updateNativeGraphicPathHandle } from "./documentWorkflow";

function fixture() {return applyNativeArtLineToolAtPoint(createPhase4Document("Waves"),{x:120,y:220},{x:320,y:220},"tool.art.lineWavy");}
describe("native waviness adjustment",()=>{
  it("preserves placement, paint and selection, and retains the value in native save/reopen and SVG",()=>{
    const before=fixture(),object=before.pages[0].objects[0] as GraphicObject;
    const after=setWavyLineSmoothness(before,object.id,0.75),changed=wavyLineForAdjustment(after,object.id)!;
    expect(after.selection).toEqual(before.selection);
    expect({...changed,data:object.data}).toEqual(object);
    expect(changed.data.waveSmoothness).toBe(0.75);
    const reopened=openNativeDocument(createNativeSavePayload(after).contents).document!;
    expect(reopened).toBeDefined();expect(wavyLineForAdjustment(reopened,object.id)?.data.waveSmoothness).toBe(0.75);
    expect(planNativeArtVisual(wavyLineForAdjustment(reopened,object.id)!).pathD).toEqual(planNativeArtVisual(changed).pathD);
    expect(exportDocumentToSvg(reopened).contents).toContain("Q");
    const resized=updateNativeGraphicPathHandle(after,object.id,"end",{x:380,y:260});
    expect(wavyLineForAdjustment(resized,object.id)?.data.waveSmoothness).toBe(0.75);
    expect(setWavyLineSmoothness(after,object.id,0.75)).toBe(after);
    expect(setWavyLineSmoothness(before,object.id,undefined)).toBe(before);
  });
  it("enables only wavy targets and safely ignores invalid input or other graphics",()=>{
    const before=fixture(),id=before.pages[0].objects[0].id;
    expect(createLayerActions(before,id).find(a=>a.id==="art.adjustWaviness")?.enabled).toBe(true);
    const straight=applyPatches(before,[{op:"updateObject",objectId:id,changes:{data:{artPathKind:"line"}}}]);
    expect(createLayerActions(straight,id).find(a=>a.id==="art.adjustWaviness")?.enabled).toBe(false);
    expect(setWavyLineSmoothness(straight,id,0.5)).toBe(straight);
    expect(setWavyLineSmoothness(before,id,NaN)).toBe(before);
    expect(wavyLineForAdjustment(setWavyLineSmoothness(before,id,-4),id)?.data.waveSmoothness).toBe(0);
    expect(wavyLineForAdjustment(setWavyLineSmoothness(before,id,4),id)?.data.waveSmoothness).toBe(1);
  });
  it("stores amplitude independently, restores both controls in native files, and keeps resized peaks inside the frame",()=>{
    const before=fixture(),id=before.pages[0].objects[0].id;
    const taller=setWavyLineSettings(before,id,{amplitudePx:18}),tall=wavyLineForAdjustment(taller,id)!;
    expect(tall.data.waveSmoothness).toBeUndefined();expect(tall.data.waveAmplitudePx).toBe(18);
    const both=setWavyLineSettings(taller,id,{smoothness:0.6,amplitudePx:30,cycles:6});
    const reopened=openNativeDocument(createNativeSavePayload(both).contents).document!;
    expect(wavyLineForAdjustment(reopened,id)?.data).toMatchObject({waveSmoothness:0.6,waveAmplitudePx:30,waveCycles:6});
    const resized=updateNativeGraphicPathHandle(reopened,id,"end",{x:380,y:220}),wave=wavyLineForAdjustment(resized,id)!;
    expect(wave.y).toBeLessThanOrEqual(190);expect(wave.y+wave.height).toBeGreaterThanOrEqual(250);
    expect(wave.data).toMatchObject({waveAmplitudePx:30,waveSmoothness:0.6,waveCycles:6});
    expect(planNativeArtVisual(wave).pathD!.match(/ Q /g)).toHaveLength(12);
    expect(setWavyLineSettings(taller,id,{amplitudePx:18})).toBe(taller);
    expect(setWavyLineSettings(taller,id,{amplitudePx:NaN})).toBe(taller);
    expect(wavyLineForAdjustment(setWavyLineSettings(before,id,{amplitudePx:-1}),id)?.data.waveAmplitudePx).toBe(0);
    expect(wavyLineForAdjustment(setWavyLineSettings(before,id,{amplitudePx:100}),id)?.data.waveAmplitudePx).toBe(40);
  });
  it("adjusts frequency independently on a legacy wave and clamps to whole bounded cycles",()=>{
    const before=fixture(),id=before.pages[0].objects[0].id;
    const adjusted=setWavyLineSettings(before,id,{cycles:5}),wave=wavyLineForAdjustment(adjusted,id)!;
    expect(wave.data.waveSmoothness).toBeUndefined();expect(wave.data.waveAmplitudePx).toBeUndefined();
    expect(wave.data.waveCycles).toBe(5);expect(planNativeArtVisual(wave).pathD).toMatch(/ L /);
    expect(setWavyLineSettings(adjusted,id,{cycles:5})).toBe(adjusted);
    expect(setWavyLineSettings(adjusted,id,{cycles:NaN})).toBe(adjusted);
    for(const [input,expected] of [[0,1],[900,512],[6.8,7]]) {
      expect(wavyLineForAdjustment(setWavyLineSettings(before,id,{cycles:input}),id)?.data.waveCycles).toBe(expected);
    }
  });
});
