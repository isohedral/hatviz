// Constants for hexagonal points calculations
const hr3 = 0.8660254037844386467637; // Sqrt(3)/2
const ident = [1, 0, 0, 0, 1, 0];

// Variables for managing the transformations and drawing
let to_screen = [20, 0, 0, 0, -20, 0];
let lw_scale = 1;
let tiles;
let level;

// Variables for scaling
let scale_centre;
let scale_start;
let scale_ts;

// UI elements
let reset_button;
let subst_button;
let translate_button;
let scale_button;
let draw_hats;
let draw_super;
let radio;
let cp_h1;
let cp_h;
let cp_t;
let cp_p;
let cp_f;
let dragging = false;
let uibox = true;
let box_height = 10;

// Geometric shapes representing the tiles
let H1_hat;
let H_hat;
let T_hat;
let P_hat;
let F_hat;

let svg_serial = 0;
// Initial colors for the tiles
let h1_color = [0, 137, 212];
let h_color = [148, 205, 235];
let t_color = [251, 251, 251];
let p_color = [250, 250, 250];
let f_color = [191, 191, 191];
let truchet_color = [0, 137, 212];
let background_color =[255,255,255];

// Helper functions for color management
function color2rgb(c) {
    return [c.levels[0], c.levels[1], c.levels[2]];
}
function set_truchet_color(){
    truchet_color = color2rgb(cp_truchet.color());
}
function set_background_color(){
    background_color = color2rgb(cp_bg.color());
}

// Define point (x,y)
function pt(x, y) {
    return { x: x, y: y };
}

// Translate point to hexagonal grid
function hexPt(x, y) {
    return pt(x + 0.5 * y, hr3 * y);
}

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


// Affine matrix inverse
function inv(T) {
    const det = T[0] * T[4] - T[1] * T[3];
    return [
	T[4] / det, -T[1] / det, (T[1] * T[5] - T[2] * T[4]) / det,
	-T[3] / det, T[0] / det, (T[2] * T[3] - T[0] * T[5]) / det
    ];
};

// Affine matrix multiply
function mul(A, B) {
    return [
	A[0] * B[0] + A[1] * B[3],
	A[0] * B[1] + A[1] * B[4],
	A[0] * B[2] + A[1] * B[5] + A[2],

	A[3] * B[0] + A[4] * B[3],
	A[3] * B[1] + A[4] * B[4],
	A[3] * B[2] + A[4] * B[5] + A[5]
    ];
}

// Point add - Add p to q
function padd(p, q) {
    return { x: p.x + q.x, y: p.y + q.y };
}

// Point subtract - Subtract q from p
function psub(p, q) {
    return { x: p.x - q.x, y: p.y - q.y };
}

// Rotation matrix
function trot(ang) {
    const c = cos(ang);
    const s = sin(ang);
    return [c, -s, 0, s, c, 0];
}

// Translation matrix
function ttrans(tx, ty) {
    return [1, 0, tx, 0, 1, ty];
}

function rotAbout(p, ang) {
    return mul(ttrans(p.x, p.y),
	       mul(trot(ang), ttrans(-p.x, -p.y)));
}

// Matrix * point
function transPt(M, P) {
    return pt(M[0] * P.x + M[1] * P.y + M[2], M[3] * P.x + M[4] * P.y + M[5]);
}

// Match unit interval to line segment p->q
function matchSeg(p, q) {
    return [q.x - p.x, p.y - q.y, p.x, q.y - p.y, q.x - p.x, p.y];
}

// Match line segment p1->q1 to line segment p2->q2
function matchTwo( p1, q1, p2, q2 )
{
    return mul( matchSeg( p2, q2 ), inv( matchSeg( p1, q1 ) ) );
}

// This function computes the intersection point of two lines, given two points on each line.
function intersect( p1, q1, p2, q2 )
{
    const d = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y);
    const uA = ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / d;
    const uB = ((q1.x - p1.x) * (p1.y - p2.y) - (q1.y - p1.y) * (p1.x - p2.x)) / d;

    return pt( p1.x + uA * (q1.x - p1.x), p1.y + uA * (q1.y - p1.y) );
}

// This function draws a polygon with the given shape, transformation matrix (T), fill color (f), stroke color (s), and stroke weight (w).
function drawPolygon( shape, T, f, s, w )
{
    if( f != null ) { // Set fill color or disable fill
	fill( ...f );
    } else {
	noFill();
    }
    if( s != null ) { // Set stroke color, stroke weight or disable stroke
	stroke( ...s );
	strokeWeight( w * lw_scale );
    } else {
	noStroke();
    }
    beginShape(); // Start drawing the polygon
    for( let p of shape ) {
	const tp = transPt( T, p );
	vertex( tp.x, tp.y );
    }
    endShape( CLOSE ); // Close the polygon
}

function drawTruchet(shape,T,f,s,w)
{
    if( f != null ) { // Set fill color or disable fill
	fill( ...f );
    } else {
	noFill();
    }
    if( s != null ) { // Set stroke color, stroke weight or disable stroke
	stroke( ...s );
	strokeWeight( w * lw_scale );
    } else {
	noStroke();
    }
    //Bottom disk
    //The center of the bottom disk
    let c = hexPt(-2,4);
    //Left arm
    let l = pt(lerp(shape[12].x,shape[0].x,0.5),lerp(shape[12].y,shape[0].y,0.5));		      
    //Right arm
    let r = pt(lerp(shape[9].x,shape[10].x,0.5),lerp(shape[9].y,shape[10].y,0.5));

    beginShape();
    for(let p of [r,shape[10],shape[11],shape[12],l]){
	const pt = transPt(T,p);
	vertex(pt.x,pt.y);
    }
    for(let arcPoint of arcPoints(c.x,c.y,r.x,r.y,l.x,l.y,20))
    {
	const pt = transPt(T,arcPoint);
	vertex(pt.x, pt.y);
    }
    endShape();    

    // Belt
    beginShape();
    let startpoint = pt(lerp(shape[0].x,shape[1].x,0.5),lerp(shape[0].y,shape[1].y,0.5));
    for(let p of [startpoint,shape[1],shape[2],shape[3],shape[4]]){
	const tp = transPt(T,p);
	vertex(tp.x,tp.y);
    }
    //Upper arc
    c = shape[5]
    l = pt(lerp(shape[5].x,shape[4].x,0.5),lerp(shape[5].y,shape[4].y,0.5));
    r = pt(lerp(shape[5].x,shape[6].x,0.5),lerp(shape[5].y,shape[6].y,0.5));
    for(let arcPoint of arcPoints(c.x,c.y,l.x,l.y,r.x,r.y,20))
    {
	const pt = transPt(T,arcPoint);
	vertex(pt.x, pt.y);
    }
    for(let p of [shape[6],shape[7],shape[8]]){
	const tp = transPt(T,p);
	vertex(tp.x,tp.y);
    }

    //lower main arc
    l = pt(lerp(shape[4].x,shape[0].x,0.5),lerp(shape[4].y,shape[0].y,0.5));		      
    r = pt(lerp(shape[8].x,shape[9].x,0.5),lerp(shape[8].y,shape[9].y,0.5));

    for(let arcPoint of arcPoints(c.x,c.y,r.x,r.y,l.x,l.y,20))
    {
	const pt = transPt(T,arcPoint);
	vertex(pt.x, pt.y);
    }
    //lower minor arc
    c = shape[0];
    r = l;
    l = startpoint;
    
    for(let arcPoint of arcPoints(c.x,c.y,r.x,r.y,l.x,l.y,20))
    {
	const pt = transPt(T,arcPoint);
	vertex(pt.x, pt.y);
    }
    endShape();        
}

// Geom class represents polygons and their children, along with their fill and stroke colors.
class Geom
{
    constructor( pgon, fill, stroke ) 
    {
	this.shape = pgon; // The polygon shape
	this.fill = fill // The fill color
	this.stroke = stroke; // The stroke color
	this.width = 1.0; // The stroke width
	this.children = []; // The children polygons of this polygon
	this.svg_id = null; // The SVG ID of this polygon
    }

    // Adds a child polygon with the given transformation matrix (T) and geometry (geom).
    addChild( T, geom )
    {
	this.children.push( { T : T, geom : geom } );
    }

    // Evaluates the position of the i-th point of the n-th child polygon.
    evalChild( n, i )
    {
	return transPt( this.children[n].T, this.children[n].geom.shape[i] );
    }

    // Draws the polygon and its children at the given level using a given transformation matrix (S).
    draw( S, level )
    {
	if( level > 0 ) {
	    for( let g of this.children ) {
		g.geom.draw( mul( S, g.T ), level - 1 );
		
	    }
	} else {
	    drawPolygon( this.shape, S, this.fill, this.stroke, this.width );	    
	}
    }

    // Draws a truchet tile on the polygon
    drawTruchet( S, level )
    {
	if( level > 0 ) {
	    for( let g of this.children ) {
		g.geom.drawTruchet( mul( S, g.T ), level - 1 );
		
	    }
	} else {
	    if (this.shape.length == 13) {
	    	drawTruchet(this.shape,S,truchet_color,truchet_color,.4);
	    }
	}
    }
    

    // Recomputes the center of the polygon and repositions its children accordingly.
    recentre()
    {
	let cx = 0;
	let cy = 0;
	for( let p of this.shape ) {
	    cx += p.x;
	    cy += p.y;
	}
	cx /= this.shape.length;
	cy /= this.shape.length;
	const tr = pt( -cx, -cy );

	for( let idx = 0; idx < this.shape.length; ++idx ) {
	    this.shape[idx] = padd( this.shape[idx], tr );
	}

	const M = ttrans( -cx, -cy );
	for( let ch of this.children ) {
	    ch.T = mul( M, ch.T );
	}
    }

    // Resets the SVG ID of this polygon and its children.
    resetSVG()
    {
	for( let ch of this.children ) {
	    ch.geom.resetSVG();
	}
	this.svg_id = null;
    }

    buildSVGDefs( stream, sc )
    {
	if( this.svg_id != null ) {
	    return;
	}

	this.svg_id = 't' + String(svg_serial).padStart( 5, '0' );
	++svg_serial;

	for( let ch of this.children ) {
	    const T = ch.T;
	    ch.geom.buildSVGDefs( stream, sc * mag( T[0], T[1] ) );
	}

	// Stroked group
	stream.push( `  <g id="${this.svg_id}s">` );

	for( let ch of this.children ) {
	    const T = ch.T;
	    const gid = ch.geom.svg_id;
	    stream.push( `    <use xlink:href="#${gid}s" transform="matrix(${T[0]} ${T[3]} ${T[1]} ${T[4]} ${T[2]} ${T[5]})"/>` );
	}

	if( (this.shape.length > 0) && (this.fill == null) ) {
	    let verts = '';
	    for( let p of this.shape ) {
		if( verts.length > 0 ) {
		    verts = verts + ' ';
		}
		verts = verts + p.x + ',' + p.y;
	    }
	    let str = ' stroke="none"';
	    if( this.stroke != null ) {
		let st = this.stroke;
		if( st.length == 1 ) {
		    st = [st[0], st[0], st[0]];
		}

		str = ` stroke="rgb(${st[0]},${st[1]},${st[2]})" stroke-width="${this.width*lw_scale/sc}"`;
	    }

	    stream.push( `    <polygon points="${verts}" fill="none"${str}/>` );
	}

	stream.push( '  </g>' );

	// Filled group
	stream.push( `  <g id="${this.svg_id}f">` );

	for( let ch of this.children ) {
	    const T = ch.T;
	    const gid = ch.geom.svg_id;
	    stream.push( `    <use xlink:href="#${gid}f" transform="matrix(${T[0]} ${T[3]} ${T[1]} ${T[4]} ${T[2]} ${T[5]})"/>` );
	}

	if( (this.shape.length > 0) && (this.fill != null) ) {
	    let verts = '';
	    for( let p of this.shape ) {
		if( verts.length > 0 ) {
		    verts = verts + ' ';
		}
		verts = verts + p.x + ',' + p.y;
	    }
	    let str = ' stroke="none"';
	    if( this.stroke != null ) {
		let st = this.stroke;
		if( st.length == 1 ) {
		    st = [st[0], st[0], st[0]];
		}

		str = ` stroke="rgb(${st[0]},${st[1]},${st[2]})" stroke-width="${this.width*lw_scale/sc}"`;
	    }

	    let fil = ' fill="none"';
	    if( this.fill != null ) {
		fil = ` fill="rgb(${this.fill[0]},${this.fill[1]},${this.fill[2]})"`;
	    }

	    stream.push( `    <polygon points="${verts}"${str}${fil}/>` );
	}

	stream.push( '  </g>' );
    }
}

// Define the 'hat' outline as an array of points in the hexagonal grid
const hat_outline = [
    hexPt(0, 0), hexPt(-1,-1), hexPt(0,-2), hexPt(2,-2),
    hexPt(2,-1), hexPt(4,-2), hexPt(5,-1), hexPt(4, 0),
    hexPt(3, 0), hexPt(2, 2), hexPt(0, 3), hexPt(0, 2),
    hexPt(-1, 2) ];

// Create 'hat' geometry for each tile type (H1, H, T, P, F)
H1_hat = new Geom( hat_outline, h1_color, [0, 0, 0] );
H_hat = new Geom( hat_outline, h_color, [0, 0, 0] );
T_hat = new Geom( hat_outline, t_color, [0, 0, 0] );
P_hat = new Geom( hat_outline, p_color, [0, 0, 0] );
F_hat = new Geom( hat_outline, f_color, [0, 0, 0] );

// Define the H supertile
const H_init = (function () {
    // Define the initial H supertile outline
    const H_outline = [
	pt( 0, 0 ), pt( 4, 0 ), pt( 4.5, hr3 ),
	pt( 2.5, 5 * hr3 ), pt( 1.5, 5 * hr3 ), pt( -0.5, hr3 ) ];
    geom = new Geom( H_outline, null, [0,0,0] );
    geom.width = 2;

    // Add H_hat as children in the H supertile
    geom.addChild( 
	matchTwo( 
	    hat_outline[5], hat_outline[7], H_outline[5], H_outline[0] ),
	H_hat );
    geom.addChild( 
	matchTwo( 
	    hat_outline[9], hat_outline[11], H_outline[1], H_outline[2] ),
	H_hat );
    geom.addChild( 
	matchTwo( 
	    hat_outline[5], hat_outline[7], H_outline[3], H_outline[4] ),
	H_hat );

    // Add H1_hat as a child in the H supertile
    geom.addChild( 
	mul( ttrans( 2.5, hr3 ), 
	     mul( 
		 [-0.5,-hr3,0,hr3,-0.5,0],
		 [0.5,0,0,0,-0.5,0] ) ),
	H1_hat );

    return geom; }());

// Define the T supertile
const T_init = (function () {
    // Define the initial T supertile outline
    const T_outline = [
	pt( 0, 0 ), pt( 3, 0 ), pt( 1.5, 3 * hr3 ) ];
    geom = new Geom( T_outline, null, [0,0,0] );
    geom.width = 2;

    // Add T_hat as a child in the T supertile
    geom.addChild( 
	[0.5, 0, 0.5, 0, 0.5, hr3],
	T_hat );

    return geom; }());

// Define the P supertile
const P_init = (function () {
    // Define the initial P supertile outline
    const P_outline = [
	pt( 0, 0 ), pt( 4, 0 ), 
	pt( 3, 2 * hr3 ), pt( -1, 2 * hr3 ) ];
    geom = new Geom( P_outline, null, [0,0,0] );
    geom.width = 2;

    // Add P_hat as children in the P supertile
    geom.addChild( 
	[0.5, 0, 1.5, 0, 0.5, hr3],
	P_hat );
    geom.addChild( 
	mul( ttrans( 0, 2 * hr3 ), 
	     mul( [0.5, hr3, 0, -hr3, 0.5, 0],
		  [0.5, 0.0, 0.0, 0.0, 0.5, 0.0] ) ),
	P_hat );

    return geom; }());
// Define the F supertile
const F_init = (function () {
    const F_outline = [
	pt( 0, 0 ), pt( 3, 0 ), 
	pt( 3.5, hr3 ), pt( 3, 2 * hr3 ), pt( -1, 2 * hr3 ) ];
    geom = new Geom( F_outline, null, [0,0,0] );
    geom.width = 2;

    geom.addChild( 
	[0.5, 0, 1.5, 0, 0.5, hr3],
	F_hat );
    geom.addChild( 
	mul( ttrans( 0, 2 * hr3 ), 
	     mul( [0.5, hr3, 0, -hr3, 0.5, 0],
		  [0.5, 0.0, 0.0, 0.0, 0.5, 0.0] ) ),
	F_hat );

    return geom; }());

// This function constructs a patch of aperiodic hat tiles using the given H, T, P, and F super-tiles.
function constructPatch( H, T, P, F )
{
    // This list of rules defines how to combine the super-tiles to create the final patch.
    const rules = [
	['H'],
	[0, 0, 'P', 2],
	[1, 0, 'H', 2],
	[2, 0, 'P', 2],
	[3, 0, 'H', 2],
	[4, 4, 'P', 2],
	[0, 4, 'F', 3],
	[2, 4, 'F', 3],
	[4, 1, 3, 2, 'F', 0],
	[8, 3, 'H', 0],
	[9, 2, 'P', 0],
	[10, 2, 'H', 0],
	[11, 4, 'P', 2],
	[12, 0, 'H', 2],
	[13, 0, 'F', 3],
	[14, 2, 'F', 1],
	[15, 3, 'H', 4],
	[8, 2, 'F', 1], 
	[17, 3, 'H', 0],
	[18, 2, 'P', 0],
	[19, 2, 'H', 2],
	[20, 4, 'F', 3],
	[20, 0, 'P', 2],
	[22, 0, 'H', 2],
	[23, 4, 'F', 3],
	[23, 0, 'F', 3],
	[16, 0, 'P', 2],
	[9, 4, 0, 2, 'T', 2],
	[4, 0, 'F', 3] 
    ];

    // Create a new empty geometry object with the same width as H.
    ret = new Geom( [], null, null );
    ret.width = H.width;

    // Create a dictionary to map the super-tile names to their corresponding objects.
    shapes = { 'H' : H, 'T' : T, 'P' : P, 'F' : F };

    // Iterate through the rules and construct the patch by combining the super-tiles.
    for( let r of rules ) {
	if( r.length == 1 ) {
	    ret.addChild( ident, shapes[r[0]] );
	} else if( r.length == 4 ) {
	    const poly = ret.children[r[0]].geom.shape;
	    const T = ret.children[r[0]].T;
	    const P = transPt( T, poly[(r[1]+1)%poly.length] );
	    const Q = transPt( T, poly[r[1]] );
	    const nshp = shapes[r[2]];
	    const npoly = nshp.shape;

	    ret.addChild(
		matchTwo( npoly[r[3]], npoly[(r[3]+1)%npoly.length], P, Q ),
		nshp );
	} else {
	    const chP = ret.children[r[0]];
	    const chQ = ret.children[r[2]];

	    const P = transPt( chQ.T, chQ.geom.shape[r[3]] );
	    const Q = transPt( chP.T, chP.geom.shape[r[1]] );
	    const nshp = shapes[r[4]];
	    const npoly = nshp.shape;

	    ret.addChild(
		matchTwo( npoly[r[5]], npoly[(r[5]+1)%npoly.length], P, Q ),
		nshp );
	}
    }

    // Return the constructed patch.
    return ret;
}

// This function takes a patch object as input and constructs metatiles (H, T, P, F) from it.
function constructMetatiles(patch) {
    // Calculate some intermediate points used later in the function.
    const bps1 = patch.evalChild(8, 2);
    const bps2 = patch.evalChild(21, 2);
    const rbps = transPt(rotAbout(bps1, -2.0 * PI / 3.0), bps2);

    const p72 = patch.evalChild(7, 2);
    const p252 = patch.evalChild(25, 2);

    // Calculate the lower left corner (llc) of the H metatile.
    const llc = intersect(bps1, rbps, patch.evalChild(6, 2), p72);
    let w = psub(patch.evalChild(6, 2), llc);

    // Define the outline of the H metatile.
    const new_H_outline = [llc, bps1];
    w = transPt(trot(-PI / 3), w);
    new_H_outline.push(padd(new_H_outline[1], w));
    new_H_outline.push(patch.evalChild(14, 2));
    w = transPt(trot(-PI / 3), w);
    new_H_outline.push(psub(new_H_outline[3], w));
    new_H_outline.push(patch.evalChild(6, 2));

    // Create the H metatile object.
    const new_H = new Geom(new_H_outline, null, [0, 0, 0]);
    new_H.width = patch.width * 2;
    for (let ch of [0, 9, 16, 27, 26, 6, 1, 8, 10, 15]) {
	new_H.addChild(patch.children[ch].T, patch.children[ch].geom);
    }

    // Define the outline of the P metatile.
    const new_P_outline = [p72, padd(p72, psub(bps1, llc)), bps1, llc];
    const new_P = new Geom(new_P_outline, null, [0, 0, 0]);
    new_P.width = patch.width * 2;
    for (let ch of [7, 2, 3, 4, 28]) {
	new_P.addChild(patch.children[ch].T, patch.children[ch].geom);
    }

    // Define the outline of the F metatile.
    const new_F_outline = [
	bps2,
	patch.evalChild(24, 2),
	patch.evalChild(25, 0),
	p252,
	padd(p252, psub(llc, bps1)),
    ];
    const new_F = new Geom(new_F_outline, null, [0, 0, 0]);
    new_F.width = patch.width * 2;
    for (let ch of [21, 20, 22, 23, 24, 25]) {
	new_F.addChild(patch.children[ch].T, patch.children[ch].geom);
    }

    // Define the outline of the T metatile.
    const AAA = new_H_outline[2];
    const BBB = padd(new_H_outline[1], psub(new_H_outline[4], new_H_outline[5]));
    const CCC = transPt(rotAbout(BBB, -PI / 3), AAA);
    const new_T_outline = [BBB, CCC, AAA];
    const new_T = new Geom(new_T_outline, null, [0, 0, 0]);
    new_T.width = patch.width * 2;
    new_T.addChild(patch.children[11].T, patch.children[11].geom);

    // Recenter the metatiles.
    new_H.recentre();
    new_P.recentre();
    new_F.recentre();
    new_T.recentre();

    // Return the constructed metatiles.
    return [new_H, new_T, new_P, new_F];
}

function isButtonActive( but )
{
    return but.elt.style.border.length > 0;
}

function setButtonActive( but, b )
{
    but.elt.style.border = (b ? "3px solid black" : "");
}

function setup() {
    createCanvas( windowWidth, windowHeight );

    tiles = [H_init, T_init, P_init, F_init];
    level = 1;

    reset_button = createButton( "Reset" );
    reset_button.position( 10, box_height );
    reset_button.size( 125, 25 );
    reset_button.mousePressed( function() {
	tiles = [H_init, T_init, P_init, F_init];
	level = 1;
	radio.selected( 'H' );
	to_screen = [20, 0, 0, 0, -20, 0];
	lw_scale = 1;
	setButtonActive( draw_hats, true );
	setButtonActive( draw_super, true );
	loop();
    } );
    box_height += 30;

    subst_button = createButton( "Build Supertiles" );
    subst_button.position( 10, box_height );
    subst_button.size( 125, 25 );
    subst_button.mousePressed( function() {
	const patch = constructPatch( ...tiles );
	tiles = constructMetatiles( patch );
	++level;
	loop();
    } );
    box_height += 40;

    radio = createRadio();
    radio.mousePressed( function() { loop() } );
    radio.position( 10, box_height );
    for( let s of ['H', 'T', 'P', 'F'] ) {
	let o = radio.option( s );
	o.onclick = loop;
    }
    radio.selected( 'H' );
    box_height += 40;

    // Add a new function to create color picker with label
    function createColorPickerWithLabel(labelText, inputColor, xPos, yPos) {
        const label = createElement('label', labelText);
        label.position(xPos, yPos);

        const cp = createColorPicker(inputColor);
	cp.mousePressed( function() { loop() } );	
        cp.position(xPos, yPos+20);

        return cp;
    }

    // Replace the existing color pickers with the new function
    cp_h1 = createColorPickerWithLabel('H1', color(...h1_color), 10, box_height);
    cp_h1.input(() => {H1_hat.fill = color2rgb(cp_h1.color());});

    cp_h =createColorPickerWithLabel('H', color(...h_color), 80, box_height);
    cp_h.input(() => {H_hat.fill = color2rgb(cp_h.color());});
    box_height += 50;

    cp_t = createColorPickerWithLabel('T', color(...t_color), 10, box_height);
    cp_t.input(() => {T_hat.fill = color2rgb(cp_t.color());});

    cp_p = createColorPickerWithLabel('P', color(...p_color), 80, box_height);
    cp_p.input(() => {P_hat.fill = color2rgb(cp_p.color());});
    box_height += 50;

    cp_f = createColorPickerWithLabel('F', color(...f_color), 10, box_height);
    cp_f.input(() => {F_hat.fill= color2rgb(cp_f.color());});

    // Add stroke pickers with checkboxes
    cp_s = createColorPickerWithLabel('',color(0,0,0), 80, box_height);
    cp_s.input(() => {
	const strokeColor = color2rgb(cp_s.color());
	H1_hat.stroke = strokeColor;
	H_hat.stroke = strokeColor;
	T_hat.stroke = strokeColor;
	P_hat.stroke = strokeColor;
	F_hat.stroke = strokeColor;
    });

    const strokeCheckbox = createCheckbox('Stroke',true);
    strokeCheckbox.position(75, box_height);
    strokeCheckbox.changed(function() {
	if (this.checked()) {
	    const strokeColor = color2rgb(cp_s.color());
	    H1_hat.stroke = strokeColor;
	    H_hat.stroke = strokeColor;
	    T_hat.stroke = strokeColor;
	    P_hat.stroke = strokeColor;
	    F_hat.stroke = strokeColor;
	} else {
	    const weakStroke = 0.2;
	    H1_hat.stroke = H1_hat.fill;	    
	    H_hat.stroke = H_hat.fill;
	    T_hat.stroke = T_hat.fill;
	    P_hat.stroke = P_hat.fill;
	    F_hat.stroke = F_hat.fill;
	    H1_hat.width = weakStroke;
	    H_hat.width = weakStroke;
	    T_hat.width = weakStroke;
	    P_hat.width = weakStroke;
	    F_hat.width = weakStroke;
	}
    });
    box_height += 50;
        
    cp_bg = createColorPickerWithLabel('Void', color(...background_color), 10, box_height);
    cp_bg.input(() => {background_color = color2rgb(cp_bg.color());});

    cp_truchet = createColorPickerWithLabel('Truchet', color(...truchet_color), 80, box_height);
    cp_truchet.input(() => {truchet_color = color2rgb(cp_truchet.color());});
    
    box_height += 60;

    translate_button = createButton( "Translate" );
    setButtonActive( translate_button, true );
    translate_button.position( 10, box_height );
    translate_button.size( 125, 25 );
    translate_button.mousePressed( function() {
	setButtonActive( translate_button, true );
	setButtonActive( scale_button, false );
	loop();
    } );
    box_height += 30;

    scale_button = createButton( "Scale" );
    scale_button.position( 10, box_height );
    scale_button.size( 125, 25 );
    scale_button.mousePressed( function() {
	setButtonActive( translate_button, false );
	setButtonActive( scale_button, true );
	loop();
    } );
    box_height += 40;
    
    draw_hats = createButton( "Draw Hats" );
    setButtonActive( draw_hats, true );
    draw_hats.mousePressed( function() {
	setButtonActive( draw_hats, !isButtonActive( draw_hats ) );
	loop();
    } );
    draw_hats.position( 10, box_height );
    draw_hats.size( 125, 25 );
    box_height += 30;

    draw_super = createButton( "Draw Supertiles" );
    setButtonActive( draw_super, true );
    draw_super.mousePressed( function() {
	setButtonActive( draw_super, !isButtonActive( draw_super ) );
	loop();
    } );
    draw_super.position( 10, box_height );
    draw_super.size( 125, 25 );
    box_height += 30;

    // Add a new button for drawing truchet pattern
    draw_truchet = createButton('Truchet Pattern');
    setButtonActive( draw_truchet, false );
    draw_truchet.mousePressed(() => {
	setButtonActive( draw_truchet, !isButtonActive( draw_truchet ) );
	loop();
    } );
    draw_truchet.position(10, box_height);
    draw_truchet.size( 125, 25 );
    box_height += 30;

    // Add a new button for drawing the grid
    draw_grid = createButton('Draw Grid');
    setButtonActive( draw_grid, false );
    draw_grid.mousePressed(() => {
	setButtonActive( draw_grid, !isButtonActive( draw_grid ) );
	loop();
    } );
    draw_grid.position(10, box_height);
    draw_grid.size( 125, 25 );
    box_height += 40;

    let save_button = createButton( "Save PNG" );
    save_button.position( 10, box_height );
    save_button.size( 125, 25 );
    save_button.mousePressed( function () {
	uibox = false;
	draw();
	save( "output.png" );
	uibox = true;
	draw();
    } );
    box_height += 30;

    let svg_button = createButton( "Save SVG" );
    svg_button.position( 10, box_height );
    svg_button.size( 125, 25 );
    svg_button.mousePressed( function () {
	svg_serial = 0;
	for( let t of tiles ) {
	    t.resetSVG();
	}

	const stream = [];
	stream.push( `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` );
	stream.push( '<defs>' );
	for( let t of tiles ) {
	    t.buildSVGDefs( stream, mag( to_screen[0], to_screen[1] ) );
	}
	stream.push( '</defs>' );

	const idx = {'H':0, 'T':1, 'P':2, 'F':3}[radio.value()];

	if( isButtonActive( draw_hats ) ) {
	    stream.push( `<use xlink:href="#${tiles[idx].svg_id}f" transform="matrix(${to_screen[0]} ${to_screen[3]} ${to_screen[1]} ${to_screen[4]} ${to_screen[2]+width/2} ${to_screen[5]+height/2})"/>` )
	}
	if( isButtonActive( draw_super ) ) {
	    stream.push( `<use xlink:href="#${tiles[idx].svg_id}s" transform="matrix(${to_screen[0]} ${to_screen[3]} ${to_screen[1]} ${to_screen[4]} ${to_screen[2]+width/2} ${to_screen[5]+height/2})"/>` )
	}
	stream.push( '</svg>' );

	saveStrings( stream, 'output', 'svg' );
    } );
    box_height += 30;
    box_height -= 5; // remove half the padding
}

function draw()
{
    background( background_color );

    push();
    translate( width/2, height/2 );
    const idx = {'H':0, 'T':1, 'P':2, 'F':3}[radio.value()];

    if( isButtonActive( draw_hats ) ) {
	tiles[idx].draw( to_screen, level );
    }

    if( isButtonActive( draw_super ) ) {
	for( let lev = level - 1; lev >= 0; --lev ) {
	    tiles[idx].draw( to_screen, lev );
	}
    }

    if ( isButtonActive( draw_truchet) ){
	tiles[idx].drawTruchet( to_screen, level );
    }

    const gridScaler = [10, 0, 0, 0, 10, 0];
    
    if (isButtonActive( draw_grid )) {
        // Add functionality to draw a 100 by 100 grid using the hexPt method
	stroke(0);
	strokeWeight(1);
	const gridSize = 40;
	const cellSize = 5;
	const offset = hexPt((gridSize/2)*cellSize,(gridSize/2)*cellSize)

	for (let x = 0; x <= gridSize; x++) {
	    for (let y = 0; y <= gridSize; y++) {
		const pt1 = psub(hexPt(x * cellSize, y * cellSize),offset);
		const pt2 = psub(hexPt((x + 1) * cellSize, y * cellSize),offset);
		const pt3 = psub(hexPt(x * cellSize, (y + 1) * cellSize),offset);;

		// Apply the transformations to the grid points
		const transformedPt1 = transPt(gridScaler, pt1);
		const transformedPt2 = transPt(gridScaler, pt2);
		const transformedPt3 = transPt(gridScaler, pt3);

		// Draw horizontal lines
		if (x < gridSize) {
                    line(transformedPt1.x, transformedPt1.y, transformedPt2.x, transformedPt2.y);
		}
		// Draw vertical lines
		if (y < gridSize) {
                    line(transformedPt1.x, transformedPt1.y, transformedPt3.x, transformedPt3.y);
		}
	    }
	}
    }
    
    pop();

    if( uibox ) {
	stroke( 0 );
	strokeWeight( 0.5 );
	fill( 255, 220 );
	rect( 5, 5, 135, box_height);
    }
    noLoop();
}

function windowResized() 
{
    resizeCanvas( windowWidth, windowHeight );
}

function mousePressed()
{
    dragging = true;
    if( isButtonActive( scale_button ) ) {
	scale_centre = transPt( inv( to_screen ), pt( width/2, height/2 ) );
	scale_start = pt( mouseX, mouseY );
	scale_ts = [...to_screen];
    }
    loop();
}

function mouseDragged()
{
    if( dragging ) {
	if( isButtonActive( translate_button ) ) {
	    to_screen = mul( ttrans( mouseX - pmouseX, mouseY - pmouseY ), 
			     to_screen );
	} else if( isButtonActive( scale_button ) ) {
	    let sc = dist( mouseX, mouseY, width/2, height/2 ) / 
		dist( scale_start.x, scale_start.y, width/2, height/2 );
	    to_screen = mul( 
		mul( ttrans( scale_centre.x, scale_centre.y ),
		     mul( [sc, 0, 0, 0, sc, 0],
			  ttrans( -scale_centre.x, -scale_centre.y ) ) ),
		scale_ts );
	    lw_scale = mag( to_screen[0], to_screen[1] ) / 20.0;
	}
	loop();
	return false;
    } 
}

function mouseReleased()
{
    dragging = false;
    loop();
}
