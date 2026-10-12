import type { GraphicObjectData } from "@chemdraft/chem-core";
import type { NativeArtBounds, NativeArtPoint } from "./index";

export interface ArrangementArrowItem {
  id: string;
  bounds: NativeArtBounds;
  anchor?: NativeArtPoint;
  /** Visible silhouette points; without them the item uses its rectangular frame. */
  outline?: readonly NativeArtPoint[];
}
export interface ArrangementArrowPlan {
  fromId: string;
  toId: string;
  bounds: NativeArtBounds;
  data: GraphicObjectData;
}
export interface ArrangementArrowCycle {
  center: NativeArtPoint;
  radiusX: number;
  radiusY: number;
}
export const arrangementArrowPadding = 12;
const headSize = 12;
const tau = Math.PI * 2;

/** Editable art arrows, clipped against padded item silhouettes including captions and long labels.
 * Items are in connection order. Elliptical cycles close; linear paths remain open. */
export function planArrangementArrows(
  items: readonly ArrangementArrowItem[],
  cycle?: ArrangementArrowCycle,
  blockers: readonly ArrangementArrowItem[] = items
): ArrangementArrowPlan[] | undefined {
  if (items.length < 2) return [];
  const obstacles = blockers.map(itemBoundaryPlanes);
  const result: ArrangementArrowPlan[] = [];
  const count = cycle ? items.length : items.length - 1;
  for (let i = 0; i < count; i++) {
    const from = items[i], to = items[(i + 1) % items.length];
    const a = from.anchor ?? center(from.bounds), b = to.anchor ?? center(to.bounds);
    let pointAt: (t: number) => NativeArtPoint;
    let cuts: number[] = [0, 1];
    let theta = 0, sweep = 0;
    if (cycle) {
      theta = Math.atan2((a.y - cycle.center.y) / cycle.radiusY, (a.x - cycle.center.x) / cycle.radiusX);
      const end = Math.atan2((b.y - cycle.center.y) / cycle.radiusY, (b.x - cycle.center.x) / cycle.radiusX);
      sweep = (end - theta + tau) % tau;
      pointAt = (t) => ellipsePoint(cycle, theta + sweep * t);
      for (const boundary of obstacles) {
        for (const plane of boundary) {
          // Intersect each offset polygon edge with the ellipse analytically.
          const x = plane.nx * cycle.radiusX, y = plane.ny * cycle.radiusY;
          const value = (plane.offset - plane.nx * cycle.center.x - plane.ny * cycle.center.y) / Math.hypot(x, y);
          if (Math.abs(value) > 1) continue;
          const phase = Math.atan2(y, x), angle = Math.acos(value);
          addAngleCuts(cuts, phase + angle, theta, sweep);
          addAngleCuts(cuts, phase - angle, theta, sweep);
        }
      }
    } else {
      pointAt = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      for (const boundary of obstacles) {
        for (const plane of boundary) {
          const delta = plane.nx * (b.x - a.x) + plane.ny * (b.y - a.y);
          if (Math.abs(delta) > 1e-12) cuts.push((plane.offset - plane.nx * a.x - plane.ny * a.y) / delta);
        }
      }
    }
    cuts = [...new Set(cuts.filter((t) => Number.isFinite(t) && t >= 0 && t <= 1))].sort((x, y) => x - y);
    const clear: Array<{ start: number; end: number }> = [];
    for (let j = 1; j < cuts.length; j++) {
      const start = cuts[j - 1], end = cuts[j];
      if (end - start < 1e-10 || obstacles.some((boundary) => inside(pointAt((start + end) / 2), boundary))) continue;
      const previous = clear.at(-1);
      if (previous && Math.abs(previous.end - start) < 1e-10) previous.end = end;
      else clear.push({ start, end });
    }
    // A third item blocking this path is a routing failure; never draw through it or silently omit an edge.
    if (clear.length !== 1) return undefined;
    const { start, end } = clear[0];
    let length = 0;
    let previous = pointAt(start);
    for (let j = 1; j <= 32; j++) {
      const point = pointAt(start + (end - start) * j / 32);
      length += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    if (length < headSize + 6) return undefined;
    const points = [pointAt(start), pointAt(end)];
    const data: GraphicObjectData = { markerEnd: { kind: "filled-arrow", sizePx: headSize } };
    if (cycle) {
      const startAngle = theta + sweep * start, arcSweep = sweep * (end - start);
      Object.assign(data, { artPathKind: "arc", artToolId: "curvedArrow90", arcCenter: cycle.center,
        arcRadiusX: cycle.radiusX, arcRadiusY: cycle.radiusY,
        arcStartRadians: startAngle, arcSweepRadians: arcSweep });
      for (let axis = -4; axis <= 8; axis++) {
        const angle = axis * Math.PI / 2;
        if (angle > startAngle && angle < startAngle + arcSweep) points.push(ellipsePoint(cycle, angle));
      }
    } else {
      Object.assign(data, { artPathKind: "line", artToolId: "reactionArrow", lineStart: points[0], lineEnd: points[1] });
    }
    const x = Math.min(...points.map((p) => p.x)), y = Math.min(...points.map((p) => p.y));
    result.push({ fromId: from.id, toId: to.id, data, bounds: expand({ x, y,
      width: Math.max(...points.map((p) => p.x)) - x, height: Math.max(...points.map((p) => p.y)) - y }, headSize / 2) });
  }
  return result;
}

function addAngleCuts(cuts: number[], angle: number, start: number, sweep: number): void {
  for (let turn = -2; turn <= 2; turn++) cuts.push((angle + turn * tau - start) / sweep);
}
function ellipsePoint(cycle: ArrangementArrowCycle, angle: number): NativeArtPoint {
  return { x: cycle.center.x + cycle.radiusX * Math.cos(angle), y: cycle.center.y + cycle.radiusY * Math.sin(angle) };
}
function center(b: NativeArtBounds): NativeArtPoint { return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
function expand(b: NativeArtBounds, padding: number): NativeArtBounds {
  return { x: b.x - padding, y: b.y - padding, width: b.width + 2 * padding, height: b.height + 2 * padding };
}
interface BoundaryPlane { nx: number; ny: number; offset: number }
function inside(p: NativeArtPoint, boundary: readonly BoundaryPlane[]): boolean {
  return boundary.every((plane) => plane.nx * p.x + plane.ny * p.y < plane.offset - 1e-9);
}
function itemBoundaryPlanes(item: ArrangementArrowItem): BoundaryPlane[] {
  const b = item.bounds;
  const corners = [{ x: b.x, y: b.y }, { x: b.x + Math.max(b.width, 1e-6), y: b.y },
    { x: b.x + Math.max(b.width, 1e-6), y: b.y + Math.max(b.height, 1e-6) }, { x: b.x, y: b.y + Math.max(b.height, 1e-6) }];
  let hull = convexHull(item.outline ?? corners);
  if (hull.length < 3) hull = convexHull(corners);
  return hull.map((a, index) => {
    const b = hull[(index + 1) % hull.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = (b.y - a.y) / length, ny = (a.x - b.x) / length;
    return { nx, ny, offset: nx * a.x + ny * a.y + arrangementArrowPadding };
  });
}

function convexHull(points: readonly NativeArtPoint[]): NativeArtPoint[] {
  const sorted = [...points].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x || a.y - b.y);
  const unique = sorted.filter((p, index) => index === 0 || p.x !== sorted[index - 1].x || p.y !== sorted[index - 1].y);
  const cross = (a: NativeArtPoint, b: NativeArtPoint, c: NativeArtPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (entries: NativeArtPoint[]) => {
    const result: NativeArtPoint[] = [];
    for (const p of entries) {
      while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, p) <= 0) result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  return [...half(unique), ...half([...unique].reverse())];
}

/** Signed midpoint offset / endpoint distance, carried with a generated connection. */
export function arrangementArrowBend(data: GraphicObjectData, from: NativeArtBounds, to: NativeArtBounds,
  fromAnchor?:NativeArtPoint,toAnchor?:NativeArtPoint): number {
  const a = fromAnchor ?? center(from), b = toAnchor ?? center(to), length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1e-6) return 0;
  let middle: NativeArtPoint | undefined;
  if (data.arcCenter && data.arcRadiusX && data.arcRadiusY) {
    middle = ellipsePoint({ center: data.arcCenter, radiusX: data.arcRadiusX, radiusY: data.arcRadiusY },
      (data.arcStartRadians ?? 0) + (data.arcSweepRadians ?? 0) / 2);
  } else middle = data.pathControlPoint;
  return middle ? ((middle.x - (a.x + b.x) / 2) * -(b.y - a.y) +
    (middle.y - (a.y + b.y) / 2) * (b.x - a.x)) / (length * length) : 0;
}

/** Refit a connection to moved endpoints. Curves retain their bend and direction; the trimmed
 * quadratic is editable with the native arrow handles. Impossible gaps return no visible shaft. */
export function planFollowingArrangementArrow(
  from: ArrangementArrowItem, to: ArrangementArrowItem, bend: number,
  obstacles: readonly ArrangementArrowItem[] = [from, to]
): ArrangementArrowPlan | undefined {
  if (Math.abs(bend) < 1e-8) return planArrangementArrows([from, to], undefined, obstacles)?.[0];
  const a = from.anchor ?? center(from.bounds), b = to.anchor ?? center(to.bounds);
  const control = { x: (a.x + b.x) / 2 - 2 * (b.y - a.y) * bend,
    y: (a.y + b.y) / 2 + 2 * (b.x - a.x) * bend };
  const at = (t: number) => ({ x: (1-t)**2*a.x + 2*t*(1-t)*control.x + t*t*b.x,
    y: (1-t)**2*a.y + 2*t*(1-t)*control.y + t*t*b.y });
  const planes = obstacles.map(itemBoundaryPlanes);
  const blocked = (t: number) => planes.some(p => inside(at(t), p));
  const count = 512;
  const clear = Array.from({length: count + 1}, (_, i) => !blocked(i/count));
  const first = clear.indexOf(true), last = clear.lastIndexOf(true);
  if (first < 0 || clear.slice(first, last + 1).some(v => !v)) return undefined;
  const boundary = (lo: number, hi: number, entering: boolean) => {
    for (let i=0; i<32; i++) { const mid=(lo+hi)/2;
      if (blocked(mid) === entering) hi=mid; else lo=mid;
    }
    return (lo+hi)/2;
  };
  const start = first === 0 ? 0 : boundary((first-1)/count, first/count, false);
  const end = last === count ? 1 : boundary(last/count, (last+1)/count, true);
  const points = Array.from({length:65}, (_,i) => at(start+(end-start)*i/64));
  const length = points.slice(1).reduce((sum,p,i) => sum + Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
  if (length < headSize + 6) return undefined;
  const x=Math.min(...points.map(p=>p.x)), y=Math.min(...points.map(p=>p.y));
  return {fromId:from.id,toId:to.id, bounds:expand({x,y,width:Math.max(...points.map(p=>p.x))-x,
    height:Math.max(...points.map(p=>p.y))-y},headSize/2), data:{artPathKind:'quadratic',artToolId:'curvedArrow90',
    lineStart:at(start),lineEnd:at(end),pathControlPoint:at((start+end)/2),markerEnd:{kind:'filled-arrow',sizePx:headSize}}};
}

export interface ReactionArrowPath {start:NativeArtPoint;end:NativeArtPoint;middle?:NativeArtPoint}
export interface ReactionOffshootGeometry {
  /** Fraction along the parent's shaft; omitted in older files means the midpoint. */
  contactT?:number;
  end:{along:number;normal:number};middle:{along:number;normal:number};
}
function reactionArrowControl(path:ReactionArrowPath) {
  const midpoint={x:(path.start.x+path.end.x)/2,y:(path.start.y+path.end.y)/2};
  const middle=path.middle ?? midpoint;
  return {x:2*middle.x-midpoint.x,y:2*middle.y-midpoint.y};
}
function reactionArrowPointAt(path:ReactionArrowPath,t:number) {
  if (t===0) return {...path.start};
  if (t===1) return {...path.end};
  if (t===0.5 && path.middle) return {...path.middle};
  const c=reactionArrowControl(path);
  return {x:(1-t)**2*path.start.x+2*t*(1-t)*c.x+t*t*path.end.x,
    y:(1-t)**2*path.start.y+2*t*(1-t)*c.y+t*t*path.end.y};
}
/** Closest contact on the visible quadratic shaft, including either endpoint. */
export function reactionArrowContactParameter(path:ReactionArrowPath,point:NativeArtPoint):number {
  const distance=(t:number)=>{const p=reactionArrowPointAt(path,t);return (p.x-point.x)**2+(p.y-point.y)**2;};
  let best=0;
  for (let i=1;i<=64;i++) if (distance(i/64)<distance(best)) best=i/64;
  let lo=Math.max(0,best-1/64),hi=Math.min(1,best+1/64);
  for (let i=0;i<40;i++) {
    const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;
    if (distance(a)<distance(b)) hi=b; else lo=a;
  }
  const candidate=(lo+hi)/2;
  return [0,candidate,1].reduce((a,b)=>distance(a)<=distance(b)?a:b);
}
export function reactionArrowFrame(path:ReactionArrowPath,contactT=0.5) {
  const t=Math.max(0,Math.min(1,contactT)),origin=reactionArrowPointAt(path,t),control=reactionArrowControl(path);
  const dx=path.end.x-path.start.x,dy=path.end.y-path.start.y,length=Math.hypot(dx,dy)||1;
  const tx=(1-t)*(control.x-path.start.x)+t*(path.end.x-control.x),
    ty=(1-t)*(control.y-path.start.y)+t*(path.end.y-control.y),tangentLength=Math.hypot(tx,ty);
  const tangent=tangentLength>1e-6?{x:tx/tangentLength,y:ty/tangentLength}:{x:dx/length,y:dy/length};
  let nx=tangent.y,ny=-tangent.x;
  const middle=reactionArrowPointAt(path,0.5);
  const bulge=(middle.x-(path.start.x+path.end.x)/2)*dy/length-(middle.y-(path.start.y+path.end.y)/2)*dx/length;
  if (Math.abs(bulge)>1e-6 ? bulge<0 : ny>0 || (Math.abs(ny)<1e-6 && nx<0)) {nx=-nx;ny=-ny;}
  return {origin,tangent,normal:{x:nx,y:ny},bulge,length};
}
export function captureReactionOffshootGeometry(parent:ReactionArrowPath,child:ReactionArrowPath,contactT=0.5):ReactionOffshootGeometry {
  const frame=reactionArrowFrame(parent,contactT);
  const local=(p:NativeArtPoint)=>({along:(p.x-frame.origin.x)*frame.tangent.x+(p.y-frame.origin.y)*frame.tangent.y,
    normal:(p.x-frame.origin.x)*frame.normal.x+(p.y-frame.origin.y)*frame.normal.y});
  return {contactT,end:local(child.end),middle:local(child.middle ?? {x:(child.start.x+child.end.x)/2,y:(child.start.y+child.end.y)/2})};
}
/** Native editable fork; local geometry follows the tangent at its movable shaft contact. */
export function planReactionOffshoot(parent:ReactionArrowPath,side:1|-1,geometry?:ReactionOffshootGeometry):{bounds:NativeArtBounds;data:GraphicObjectData} {
  const shape=geometry ?? {contactT:0.5,end:{along:40,normal:side*26},middle:{along:20,normal:side*6.5}};
  const frame=reactionArrowFrame(parent,shape.contactT);
  const world=(p:{along:number;normal:number})=>({x:frame.origin.x+frame.tangent.x*p.along+frame.normal.x*p.normal,
    y:frame.origin.y+frame.tangent.y*p.along+frame.normal.y*p.normal});
  const start=frame.origin,end=world(shape.end),middle=world(shape.middle);
  const control={x:2*middle.x-(start.x+end.x)/2,y:2*middle.y-(start.y+end.y)/2};
  const points=[start,end,control],x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return {bounds:expand({x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y},6),
    data:{artPathKind:"quadratic",artToolId:"curvedArrow90",lineStart:start,lineEnd:end,pathControlPoint:middle,
      markerEnd:{kind:"filled-arrow",sizePx:12}}};
}
/** Narrow conservative shaft boxes keep text clear without blocking a curve's empty frame corners. */
export function reactionOffshootObstacleBounds(path:ReactionArrowPath,padding=2,headPadding=6):NativeArtBounds[] {
  const middle=path.middle ?? {x:(path.start.x+path.end.x)/2,y:(path.start.y+path.end.y)/2};
  const control={x:2*middle.x-(path.start.x+path.end.x)/2,y:2*middle.y-(path.start.y+path.end.y)/2};
  const at=(t:number)=>({x:(1-t)**2*path.start.x+2*t*(1-t)*control.x+t*t*path.end.x,
    y:(1-t)**2*path.start.y+2*t*(1-t)*control.y+t*t*path.end.y});
  const boxes:NativeArtBounds[]=[];
  for (let i=0;i<32;i++) {const a=at(i/32),b=at((i+1)/32);
    boxes.push(expand({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)},padding));}
  boxes.push(expand({x:path.end.x,y:path.end.y,width:0,height:0},headPadding));
  return boxes;
}

/** Center horizontal text along the shaft midpoint's normal, including diagonal curves.
 * Small collision adjustments stay on the chosen side; a crowded label keeps its preferred anchor. */
export function planReactionConditionLabel(
  path: {start:NativeArtPoint;end:NativeArtPoint;middle?:NativeArtPoint}, size:{width:number;height:number},
  page:NativeArtBounds, obstacles:readonly NativeArtBounds[] = [], side:1|-1=1
): NativeArtPoint {
  const mid=path.middle ?? {x:(path.start.x+path.end.x)/2,y:(path.start.y+path.end.y)/2};
  const dx=path.end.x-path.start.x,dy=path.end.y-path.start.y,length=Math.hypot(dx,dy)||1;
  let nx=dy/length,ny=-dx/length;
  const bulge=(mid.x-(path.start.x+path.end.x)/2)*nx+(mid.y-(path.start.y+path.end.y)/2)*ny;
  if (Math.abs(bulge)>1e-6 ? bulge<0 : ny>0 || (Math.abs(ny)<1e-6 && nx<0)) {nx=-nx;ny=-ny;}
  nx*=side;ny*=side;
  const ax=nx,ay=ny;
  const projection=1;
  const support=Math.abs(nx)*size.width/2+Math.abs(ny)*size.height/2;
  const sagitta=Math.abs(bulge);
  const radius=sagitta>1e-6 ? length*length/(8*sagitta)+sagitta/2 : Infinity;
  const inward=side===-1 && sagitta>1e-6;
  const distance=Math.min((10+support)/projection,inward ? radius*0.75/projection : Infinity);
  const at=(extra:number,along=0) => ({
    x:Math.max(page.x,Math.min(page.x+Math.max(0,page.width-size.width),mid.x+ax*(distance+extra)+dx/length*along-size.width/2)),
    y:Math.max(page.y,Math.min(page.y+Math.max(0,page.height-size.height),mid.y+ay*(distance+extra)+dy/length*along-size.height/2))
  });
  const preferred=at(0);
  // For an inward curve, never search through the centre and out the other side.
  const extraLimit=inward
    ? Math.min(48,Math.max(0,(radius-support-10)/projection-distance)) : 48;
  let best:NativeArtPoint|undefined, bestDistance=Infinity;
  const alongOffsets:number[]=[];
  const alongLimit=Math.min(96,Math.max(40,size.width+12));
  for (let along=8;along<=alongLimit;along+=8) alongOffsets.push(-along,along);
  const clear=(result:NativeArtPoint)=>!obstacles.some(b=>result.x<b.x+b.width+6 && result.x+size.width>b.x-6 &&
    result.y<b.y+b.height+6 && result.y+size.height>b.y-6);
  // Keep the text centered over the same shaft point whenever moving outward can clear it.
  for(let extra=0;extra<=extraLimit;extra+=8) {const result=at(extra);if(clear(result)) return result;}
  for (let extra=0;extra<=extraLimit;extra+=8) {
    for (const along of alongOffsets) {
      const result=at(extra,along);
      const score=(result.x-preferred.x)**2+(result.y-preferred.y)**2;
      if (score>=bestDistance) continue;
      if (clear(result)) {best=result;bestDistance=score;}
    }
  }
  return best ?? preferred;
}
