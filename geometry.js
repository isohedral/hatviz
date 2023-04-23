const r3 = 1.7320508075688772;
const hr3 = 0.8660254037844386;
const ident = [1, 0, 0, 0, 1, 0];

function pt( x, y )
{
	return { x : x, y : y };
}

function hexPt( x, y )
{
	return pt( x + 0.5*y, hr3*y );
}

// Affine matrix inverse
function inv( T ) {
	const det = T[0]*T[4] - T[1]*T[3];
	return [T[4]/det, -T[1]/det, (T[1]*T[5]-T[2]*T[4])/det,
		-T[3]/det, T[0]/det, (T[2]*T[3]-T[0]*T[5])/det];
};

// Affine matrix multiply
function mul( A, B )
{
	return [A[0]*B[0] + A[1]*B[3], 
		A[0]*B[1] + A[1]*B[4],
		A[0]*B[2] + A[1]*B[5] + A[2],

		A[3]*B[0] + A[4]*B[3], 
		A[3]*B[1] + A[4]*B[4],
		A[3]*B[2] + A[4]*B[5] + A[5]];
}

function padd( p, q )
{
	return { x : p.x + q.x, y : p.y + q.y };
}

function psub( p, q )
{
	return { x : p.x - q.x, y : p.y - q.y };
}

// Rotation matrix
function trot( ang )
{
	const c = cos( ang );
	const s = sin( ang );
	return [c, -s, 0, s, c, 0];
}

// Translation matrix
function ttrans( tx, ty )
{
	return [1, 0, tx, 0, 1, ty];
}

function rotAbout( p, ang )
{
	return mul( ttrans( p.x, p.y ), 
		mul( trot( ang ), ttrans( -p.x, -p.y ) ) );
}

// Matrix * point
function transPt( M, P )
{
	return pt(M[0]*P.x + M[1]*P.y + M[2], M[3]*P.x + M[4]*P.y + M[5]);
}

// Match unit interval to line segment p->q
function matchSeg( p, q )
{
	return [q.x-p.x, p.y-q.y, p.x,  q.y-p.y, q.x-p.x, p.y];
};

// Match line segment p1->q1 to line segment p2->q2
function matchTwo( p1, q1, p2, q2 )
{
	return mul( matchSeg( p2, q2 ), inv( matchSeg( p1, q1 ) ) );
};

// Intersect two lines defined by segments p1->q1 and p2->q2
function intersect( p1, q1, p2, q2 )
{
    const d = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y);
    const uA = ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / d;
    const uB = ((q1.x - p1.x) * (p1.y - p2.y) - (q1.y - p1.y) * (p1.x - p2.x)) / d;

    return pt( p1.x + uA * (q1.x - p1.x), p1.y + uA * (q1.y - p1.y) );
}

const hat_outline = [
    hexPt(0, 0), hexPt(-1,-1), hexPt(0,-2), hexPt(2,-2),
    hexPt(2,-1), hexPt(4,-2), hexPt(5,-1), hexPt(4, 0),
    hexPt(3, 0), hexPt(2, 2), hexPt(0, 3), hexPt(0, 2),
    hexPt(-1, 2) ];

function arcPoints(cx,cy,sx,sy,ex,ey,t)
{
    function pointToRadian(cx,cy,px,py)
    {
	return Math.atan2(py - cy, px - cx);
    }

    function radianToPoint(cx,cy,rad,radius)
    {
	return pt(radius*cos(rad)+cx,radius*sin(rad)+cy);
    }

    let radius = dist(cx,cy,sx,sy);
    let points = []
    for (let i = 0; i <= t; i++)
    {
	px = lerp(sx,ex,i/t);
	py = lerp(sy,ey,i/t);
	points.push(radianToPoint(cx,cy,pointToRadian(cx,cy,px,py),radius));	
    }
    return points;    
}
    
function truchetTopFromHat( shape )
{
    // Belt
    let startpoint = pt(lerp(shape[0].x,shape[1].x,0.5),lerp(shape[0].y,shape[1].y,0.5));
    let beltShape =  [startpoint,shape[1],shape[2],shape[3],shape[4]];
    //Upper arc
    c = shape[5]
    l = pt(lerp(shape[5].x,shape[4].x,0.5),lerp(shape[5].y,shape[4].y,0.5));
    r = pt(lerp(shape[5].x,shape[6].x,0.5),lerp(shape[5].y,shape[6].y,0.5));
    beltShape = beltShape.concat(arcPoints(c.x,c.y,l.x,l.y,r.x,r.y,20));
    // Right side
    beltShape = beltShape.concat([shape[6],shape[7],shape[8]]);
    //lower main arc
    l = pt(lerp(shape[4].x,shape[0].x,0.5),lerp(shape[4].y,shape[0].y,0.5));		      
    r = pt(lerp(shape[8].x,shape[9].x,0.5),lerp(shape[8].y,shape[9].y,0.5));
    beltShape = beltShape.concat(arcPoints(c.x,c.y,r.x,r.y,l.x,l.y,20));
    //lower minor arc
    c = shape[0];
    r = l;
    l = startpoint;
    beltShape = beltShape.concat(arcPoints(c.x,c.y,r.x,r.y,l.x,l.y,20));
    return beltShape
}

function truchetBtmFromHat( shape )
{
    //Bottom disk
    //The center of the bottom disk
    let c = hexPt(-2,4);
    //Left arm
    let l = pt(lerp(shape[12].x,shape[0].x,0.5),lerp(shape[12].y,shape[0].y,0.5));		      
    //Right arm
    let r = pt(lerp(shape[9].x,shape[10].x,0.5),lerp(shape[9].y,shape[10].y,0.5));
    return [r,shape[10],shape[11],shape[12],l].concat(arcPoints(c.x,c.y,l.x,l.y,r.x,r.y,20));
}

// It's not safe to defined these yet. This must be done from p5js 'Setup'
let truchetTop = null;
let truchetBtm = null;
