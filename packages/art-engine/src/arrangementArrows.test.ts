import { describe, expect, it } from "vitest";
import { planArrangementArrows, planReactionConditionLabel, planNativeArtVisual, planReactionOffshoot, reactionArrowFrame,
  reactionArrowContactParameter, type ArrangementArrowItem } from "./index";
import { planObjectArrangement } from "@chemdraft/layout-engine";

const items = (count: number): ArrangementArrowItem[] => Array.from({ length: count }, (_, i) => ({
  id: `compound_${i}`, bounds: { x: 100 + (i % 4) * 100, y: 100 + Math.floor(i / 4) * 120,
    width: 20 + (i % 3) * 45, height: 25 + (i % 4) * 20 }
}));
describe("smooth offshoot contact geometry",()=>{
  it.each([1,-1] as const)("leaves straight and curved parents tangentially on side %i",side=>{
    for (const middle of [{x:200,y:200},{x:200,y:155}]) for (const contactT of [0.2,0.5,0.8]) {
      const parent={start:{x:100,y:200},end:{x:300,y:200},middle};
      const frame=reactionArrowFrame(parent,contactT);
      const plan=planReactionOffshoot(parent,side,{contactT,end:{along:40,normal:side*26},middle:{along:20,normal:side*6.5}});
      const start=plan.data.lineStart!,end=plan.data.lineEnd!,m=plan.data.pathControlPoint!;
      const control={x:2*m.x-(start.x+end.x)/2,y:2*m.y-(start.y+end.y)/2};
      expect(start).toEqual(frame.origin);
      expect((control.x-start.x)*frame.normal.x+(control.y-start.y)*frame.normal.y).toBeCloseTo(0,8);
      expect((control.x-start.x)*frame.tangent.x+(control.y-start.y)*frame.tangent.y).toBeGreaterThan(0);
      expect(((end.x-start.x)*frame.normal.x+(end.y-start.y)*frame.normal.y)*side).toBeGreaterThan(0);
      expect(reactionArrowContactParameter(parent,frame.origin)).toBeCloseTo(contactT,7);
    }
  });
});
describe("condition label centering and constrained placement", () => {
  const page = {x:0,y:0,width:1000,height:1000}, size={width:100,height:54};
  it("centers labels perpendicular to diagonal curves and alongside vertical curves", () => {
    const upper={start:{x:300,y:250},end:{x:480,y:310},middle:{x:390,y:255}};
    for (const side of [1,-1] as const) {
      const point=planReactionConditionLabel(upper,size,page,[],side);
      const delta={x:point.x+size.width/2-upper.middle.x,y:point.y+size.height/2-upper.middle.y};
      expect(delta.x*180+delta.y*60).toBeCloseTo(0);
      expect(Math.sign(point.y+size.height/2-upper.middle.y)).toBe(-side);
    }
    const right={start:{x:700,y:350},end:{x:640,y:510},middle:{x:710,y:430}};
    for (const side of [1,-1] as const) {
      const point=planReactionConditionLabel(right,size,page,[],side);
      const delta={x:point.x+size.width/2-right.middle.x,y:point.y+size.height/2-right.middle.y};
      expect(delta.x*(-60)+delta.y*160).toBeCloseTo(0);
      expect(Math.sign(point.x+size.width/2-right.middle.x)).toBe(side);
    }
  });
  it("keeps a crowded inside label at its centered preferred anchor instead of jumping across the cycle", () => {
    const path={start:{x:300,y:250},end:{x:480,y:310},middle:{x:390,y:255}};
    const preferred=planReactionConditionLabel(path,size,page,[],-1);
    expect(planReactionConditionLabel(path,size,page,[page],-1)).toEqual(preferred);
    expect(preferred.y+size.height/2).toBeGreaterThan(path.middle.y);
  });
  it("makes only a small adjustment when a clear spot exists nearby", () => {
    const path={start:{x:200,y:300},end:{x:500,y:300}};
    const preferred=planReactionConditionLabel(path,size,page);
    const result=planReactionConditionLabel(path,size,page,[{x:preferred.x,y:preferred.y+size.height-2,width:100,height:4}]);
    expect(result.x).toBe(preferred.x);
    expect(result.y).toBeLessThan(preferred.y);
    expect(preferred.y-result.y).toBeLessThanOrEqual(48);
  });
  it("keeps midpoint centering when a centered outward adjustment clears a nearby obstacle",()=>{
    const path={start:{x:200,y:300},end:{x:500,y:300}};
    const preferred=planReactionConditionLabel(path,size,page);
    const result=planReactionConditionLabel(path,size,page,[{x:preferred.x+90,y:preferred.y+30,width:30,height:26}]);
    expect(result.x).toBe(preferred.x);expect(result.y).toBeLessThan(preferred.y);
  });
  it("fits a three-line inside label between unequal fused-ring frames with a bounded adjustment", () => {
    const path={start:{x:461.5,y:186.6},end:{x:564.1,y:266.4},middle:{x:519.6,y:217.7}};
    const labelSize={width:84.12,height:54.4};
    const neighbors=[{x:343.5,y:111.6,width:113,height:130},{x:504.5,y:246.2,width:161.5,height:130}];
    const preferred=planReactionConditionLabel(path,labelSize,page,[],-1);
    const result=planReactionConditionLabel(path,labelSize,page,neighbors,-1);
    for (const box of neighbors) expect(result.x+labelSize.width<=box.x-6 || result.x>=box.x+box.width+6 ||
      result.y+labelSize.height<=box.y-6 || result.y>=box.y+box.height+6).toBe(true);
    expect(result.y+labelSize.height/2).toBeGreaterThan(path.middle.y);
    expect(Math.hypot(result.x-preferred.x,result.y-preferred.y)).toBeLessThan(112);
  });
});
describe("arrangement arrow geometry", () => {
  it.each([2, 3, 6, 7, 12])("clips %i-compound circular and elliptical cycles, including the closing edge", (count) => {
    for (const layout of ["circle", "oval"] as const) {
      const arrangement = planObjectArrangement(items(count), layout, { cyclePadding: 12 });
      if (!arrangement.ok) throw new Error("layout failed");
      const arrows = planArrangementArrows(arrangement.placements, arrangement.cycle)!;
      expect(arrows).toHaveLength(count);
      expect(arrows.at(-1)).toMatchObject({ fromId: arrangement.placements.at(-1)!.id, toId: arrangement.placements[0].id });
      for (const arrow of arrows) {
        expect(arrow.data.artPathKind).toBe("arc");
        expect(arrow.data.arcSweepRadians).toBeGreaterThan(0);
        expect(arrow.data.arcSweepRadians).toBeLessThan(Math.PI * 2 / count);
        expect(arrow.data.markerEnd).toEqual({ kind: "filled-arrow", sizePx: 12 });
        // Verify the whole drawn shaft, not just endpoints, misses every compound/label frame.
        for (let step = 0; step <= 100; step++) {
          const theta = arrow.data.arcStartRadians! + arrow.data.arcSweepRadians! * step / 100;
          const x = arrangement.cycle!.center.x + arrangement.cycle!.radiusX * Math.cos(theta);
          const y = arrangement.cycle!.center.y + arrangement.cycle!.radiusY * Math.sin(theta);
          for (const { bounds: b } of arrangement.placements) {
            expect(x < b.x - 11.99 || x > b.x + b.width + 11.99 || y < b.y - 11.99 || y > b.y + b.height + 11.99).toBe(true);
          }
        }
        const visual = planNativeArtVisual({ id: "arrow", type: "graphic", graphicKind: "path",
          ...arrow.bounds, rotation: 0, style: { strokeWidth: 2 }, data: arrow.data });
        expect(JSON.stringify(visual)).toContain("A");
      }
    }
  });
  it.each(["row", "column"] as const)("creates an open %s with edge clearance and straight arrows", (layout) => {
    const arrangement = planObjectArrangement(items(6), layout);
    if (!arrangement.ok) throw new Error("layout failed");
    const arrows = planArrangementArrows(arrangement.placements)!;
    expect(arrows).toHaveLength(5);
    for (const arrow of arrows) {
      expect(arrow.data.artPathKind).toBe("line");
      const a = arrow.data.lineStart!, b = arrow.data.lineEnd!;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(24);
    }
  });
  it("refuses a blocked or too-short connector rather than drawing through an item", () => {
    expect(planArrangementArrows([
      { id: "a", bounds: { x: 0, y: 0, width: 40, height: 40 } },
      { id: "b", bounds: { x: 200, y: 0, width: 40, height: 40 } },
      { id: "blocker", bounds: { x: 100, y: 0, width: 40, height: 40 } }
    ])).toBeUndefined();
    expect(planArrangementArrows([
      { id: "a", bounds: { x: 0, y: 0, width: 40, height: 40 } },
      { id: "b", bounds: { x: 60, y: 0, width: 40, height: 40 } }
    ])).toBeUndefined();
  });
  it("extends cycle arrows into empty frame corners while clearing the actual fused-ring silhouette", () => {
    const arrangement = planObjectArrangement(items(5), "circle");
    if (!arrangement.ok) throw new Error(arrangement.reason);
    const shaped = arrangement.placements.map((item) => {
      const b = item.bounds, cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      return { ...item, outline: [
        { x: cx - b.width / 4, y: b.y }, { x: cx + b.width / 4, y: b.y },
        { x: b.x + b.width, y: cy }, { x: cx + b.width / 4, y: b.y + b.height },
        { x: cx - b.width / 4, y: b.y + b.height }, { x: b.x, y: cy }
      ] };
    });
    const rectangular = planArrangementArrows(arrangement.placements, arrangement.cycle)!;
    const fitted = planArrangementArrows(shaped, arrangement.cycle)!;
    expect(fitted).toHaveLength(5);
    for (let i = 0; i < 2; i++) {
      const old = rectangular[i].data, next = fitted[i].data;
      expect(next.arcSweepRadians!).toBeGreaterThan(old.arcSweepRadians! + 0.01);
      expect(next.arcStartRadians! + next.arcSweepRadians!).toBeGreaterThan(old.arcStartRadians! + old.arcSweepRadians!);
    }
    const segmentDistance = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    };
    for (const arrow of fitted) {
      for (let step = 0; step <= 100; step++) {
        const angle = arrow.data.arcStartRadians! + arrow.data.arcSweepRadians! * step / 100;
        const p = { x: arrangement.cycle!.center.x + arrangement.cycle!.radiusX * Math.cos(angle),
          y: arrangement.cycle!.center.y + arrangement.cycle!.radiusY * Math.sin(angle) };
        for (const item of shaped) for (let i = 0; i < item.outline.length; i++) {
          expect(segmentDistance(p, item.outline[i], item.outline[(i + 1) % item.outline.length])).toBeGreaterThanOrEqual(11.99);
        }
      }
    }
  });
});

describe("arrows refitted after moving endpoints",()=>{
  it("keeps the drawn quadratic shaft clear of both endpoint silhouettes",async()=>{
    const {planFollowingArrangementArrow,graphicPathEditPoints}=await import("./index");
    const a={id:"a",bounds:{x:100,y:160,width:80,height:60}},b={id:"b",bounds:{x:310,y:210,width:50,height:90}};
    const plan=planFollowingArrangementArrow(a,b,-0.3)!;
    expect(plan).toBeDefined();
    const object={id:"arrow",type:"graphic" as const,graphicKind:"path" as const,...plan.bounds,rotation:0,style:{},data:plan.data};
    const points=graphicPathEditPoints(object)!;
    // pathControlPoint denotes a point on the curve at t=1/2, not a Bezier control.
    const control={x:2*points.middle.x-(points.start.x+points.end.x)/2,y:2*points.middle.y-(points.start.y+points.end.y)/2};
    for (let i=0;i<=200;i++) {
      const t=i/200,p={x:(1-t)**2*points.start.x+2*t*(1-t)*control.x+t*t*points.end.x,
        y:(1-t)**2*points.start.y+2*t*(1-t)*control.y+t*t*points.end.y};
      for (const item of [a,b]) {const box=item.bounds;
        expect(p.x<box.x-11.99 || p.x>box.x+box.width+11.99 || p.y<box.y-11.99 || p.y>box.y+box.height+11.99).toBe(true);
      }
    }
    expect(planNativeArtVisual(object).pathD).toContain("Q");
  });
  it("declines a straight path blocked by a third compound",async()=>{
    const {planFollowingArrangementArrow}=await import("./index");
    const a={id:"a",bounds:{x:0,y:0,width:40,height:40}},b={id:"b",bounds:{x:220,y:0,width:40,height:40}};
    expect(planFollowingArrangementArrow(a,b,0,[a,b,{id:"block",bounds:{x:100,y:0,width:40,height:40}}])).toBeUndefined();
  });
});
