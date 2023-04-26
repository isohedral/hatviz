let to_screen = [20, 0, 0, 0, -20, 0];
let lw_scale = 1;
let tiles;
let level;

let scale_centre;
let scale_start;
let scale_ts;

let reset_button;
let subst_button;
let translate_button;
let scale_button;
let truchetCheckbox;
let strokeCheckbox;
let draw_hats;
let draw_super;
let radio;

let dragging = false;
let uibox = true;
let box_height = 10;

let svg_serial = 0;

const cols = {};
let black;

function getSVGID()
{
	const ret = 't' + String(svg_serial).padStart( 5, '0' );
	++svg_serial;
	return ret;
}

function drawPolygon( shape, T, f, s, w )
{
	if( f != null ) {
		fill( f );
	} else {
		noFill();
	}
	if( s != null ) {
		stroke( s );
		strokeWeight( w * lw_scale );
	} else {
		noStroke();
	}
	beginShape();
	for( let p of shape ) {
		const tp = transPt( T, p );
		vertex( tp.x, tp.y );
	}
	endShape( CLOSE );
}

function polygonToSVG( shape, id, f, s, w )
{
	let verts = '';
	for( let p of shape ) {
		if( verts.length > 0 ) {
			verts = verts + ' ';
		}
		verts = verts + p.x + ',' + p.y;
	}

	let ids = '';
	if( id != null ) {
		ids = ` id="${id}"`;
	}

	let str = ' stroke="none"';
	if( s != null ) {
		str = ` stroke="rgb(${red(s)},${green(s)},${blue(s)})" stroke-width="${w}"`;
	}

	let fil = ' fill="none"';
	if( f != null ) {
		fil = ` fill="rgb(${red(f)},${green(f)},${blue(f)})"`;
	}

	return `    <polygon${ids} points="${verts}"${str}${fil}/>`;
}

function getSVGInstance( id, T )
{
	return `    <use xlink:href="#${id}" transform="matrix(${T[0]} ${T[3]} ${T[1]} ${T[4]} ${T[2]} ${T[5]})"/>`;
}

// The base level of the scene, a single hat tile, including a label
// for colouring
class HatTile
{
	constructor( label )
	{
		this.label = label;
		this.svg_id = null;
		this.svg_id_t1 = null;
		this.svg_id_t2 = null;
	}
    
	draw( S, level, truchet, stroke )
	{

	drawPolygon(
	    // The half stroke avoids conflicts when rending truchet patterns atop non-stroked hats
	    hat_outline, S, cols[this.label].color(), stroke? cols["Stroke"].color() : cols[this.label].color(), stroke? 1 : 0.5 );
	if(truchet){
		drawPolygon( 
		    truchetTop, S, cols["Truchet"].color(), stroke? cols["Stroke"].color() : cols["Truchet"].color(), 1 );
		drawPolygon( 
		    truchetBtm, S, cols["Truchet"].color(), stroke? cols["Stroke"].color() : cols["Truchet"].color(), 1 );
            }
	}

	resetSVG()
	{
		this.svg_id = null;
		this.svg_id_t1 = null;
		this.svg_id_t2 = null;
	}

	buildSVGDefs( stream, sc, truchet, stroke )
	{
		if( this.svg_id != null ) {
			return;
		}

		this.svg_id = getSVGID();
		// The half stroke avoids conflicts when rending truchet patterns atop non-stroked hats
		const strokeWidth = stroke ? lw_scale / sc : 0.5 * lw_scale / sc;
		const strokeColor = stroke ? cols["Stroke"].color() : cols[this.label].color();
		stream.push(polygonToSVG(hat_outline, this.svg_id,
			     cols[this.label].color(), strokeColor, strokeWidth));

		if (truchet) {
			const truchetStrokeColor = stroke ? cols["Stroke"].color() : cols["Truchet"].color();
			this.svg_id_t1 = getSVGID();
			this.svg_id_t2 = getSVGID();
			stream.push(polygonToSVG(truchetTop, this.svg_id_t1,
				cols["Truchet"].color(), truchetStrokeColor, strokeWidth));
		    	stream.push(polygonToSVG(truchetBtm, this.svg_id_t2,
				cols["Truchet"].color(), truchetStrokeColor, strokeWidth));
		}
	}

	getSVGStrokeID()
	{
		return null;
	}

	getSVGFillID()
	{
		return this.svg_id;
	}

    	getSVGFillIDt1()
	{
		return this.svg_id_t1;
	}

    	getSVGFillIDt2()
	{
		return this.svg_id_t2;
	}

	getText( stream, T )
	{
		// Write out the top two rows of an affine transformation matrix
		// giving the location of this hat, together with the type of 
		// this tile.
		stream.push( `${this.label} ${T[0]} ${T[1]} ${T[2]} ${T[3]} ${T[4]} ${T[5]}` )
	}
}

// A group that collects a list of transformed children and an outline
class MetaTile
{
	constructor( shape, width )
	{
		this.shape = shape;
		this.width = width;
		this.children = [];
		this.svg_id = null;
	}

	addChild( T, geom )
	{
		this.children.push( { T : T, geom : geom } );
	}

	evalChild( n, i )
	{
		return transPt( this.children[n].T, this.children[n].geom.shape[i] );
	}

	draw( S, level , truchet, stroke)
	{
		if( level > 0 ) {
			for( let g of this.children ) {
			    g.geom.draw( mul( S, g.T ), level - 1 , truchet, stroke);
			}
		} else {
			drawPolygon( this.shape, S, null, black, this.width );
		}
	}

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

	resetSVG()
	{
		for( let ch of this.children ) {
			ch.geom.resetSVG();
		}
		this.svg_id = null;
	}

	buildSVGDefs( stream, sc, truchet, stroke )
	{
		if( this.svg_id != null ) {
			return;
		}

		this.svg_id = getSVGID();

		for( let ch of this.children ) {
			ch.geom.buildSVGDefs( stream, sc, truchet, stroke );
		}

		// Construct a fill group that must live at a logical lowest
		// layer in the draw order.

		stream.push( `  <g id="${this.getSVGFillID()}">` );
		for( let ch of this.children ) {
			const fid = ch.geom.getSVGFillID();
			if( fid != null ) {
			    stream.push( getSVGInstance( fid, ch.T ) );
			    if ( truchetCheckbox.checked() && ch.geom instanceof HatTile)
			    {
				stream.push( getSVGInstance( ch.geom.getSVGFillIDt1(), ch.T ) );
				stream.push( getSVGInstance( ch.geom.getSVGFillIDt2(), ch.T ) );
			    }
			}
		}
		stream.push( '  </g>' );

		// Construct a stroke group that must live above all fill groups.

		stream.push( `  <g id="${this.getSVGStrokeID()}">` );
		for( let ch of this.children ) {
			const sid = ch.geom.getSVGStrokeID();
			if( sid != null ) {
				stream.push( getSVGInstance( sid, ch.T ) );
			}
		}
		stream.push( polygonToSVG( this.shape, 
			null, null, black, this.width*lw_scale/sc ) );

		stream.push( '  </g>' );
	}

	getSVGStrokeID()
	{
		return `${this.svg_id}s`;
	}

	getSVGFillID()
	{
		return `${this.svg_id}f`;
	}

	getText( stream, T )
	{
		for( let g of this.children ) {
			g.geom.getText( stream, mul( T, g.T ) );
		}
	}
}

const H1_hat = new HatTile( 'H1' );
const H_hat = new HatTile( 'H' );
const T_hat = new HatTile( 'T' );
const P_hat = new HatTile( 'P' );
const F_hat = new HatTile( 'F' );

const H_init = (function () {
	const H_outline = [
		pt( 0, 0 ), pt( 4, 0 ), pt( 4.5, hr3 ),
		pt( 2.5, 5 * hr3 ), pt( 1.5, 5 * hr3 ), pt( -0.5, hr3 ) ];
	const meta = new MetaTile( H_outline, 2 );

	meta.addChild( 
		matchTwo( 
			hat_outline[5], hat_outline[7], H_outline[5], H_outline[0] ),
		H_hat );
	meta.addChild( 
		matchTwo( 
			hat_outline[9], hat_outline[11], H_outline[1], H_outline[2] ),
		H_hat );
	meta.addChild( 
		matchTwo( 
			hat_outline[5], hat_outline[7], H_outline[3], H_outline[4] ),
		H_hat );
	meta.addChild( 
		mul( ttrans( 2.5, hr3 ), 
			mul( 
				[-0.5,-hr3,0,hr3,-0.5,0],
				[0.5,0,0,0,-0.5,0] ) ),
		H1_hat );

	return meta; }());

const T_init = (function () {
	const T_outline = [
		pt( 0, 0 ), pt( 3, 0 ), pt( 1.5, 3 * hr3 ) ];
	const meta = new MetaTile( T_outline, 2 );

	meta.addChild( 
		[0.5, 0, 0.5, 0, 0.5, hr3],
		T_hat );

	return meta; }());

const P_init = (function () {
	const P_outline = [
		pt( 0, 0 ), pt( 4, 0 ), 
		pt( 3, 2 * hr3 ), pt( -1, 2 * hr3 ) ];
	const meta = new MetaTile( P_outline, 2 );

	meta.addChild( 
		[0.5, 0, 1.5, 0, 0.5, hr3],
		P_hat );
	meta.addChild( 
		mul( ttrans( 0, 2 * hr3 ), 
			mul( [0.5, hr3, 0, -hr3, 0.5, 0],
				 [0.5, 0.0, 0.0, 0.0, 0.5, 0.0] ) ),
		P_hat );

	return meta; }());

const F_init = (function () {
	const F_outline = [
		pt( 0, 0 ), pt( 3, 0 ), 
		pt( 3.5, hr3 ), pt( 3, 2 * hr3 ), pt( -1, 2 * hr3 ) ];
	const meta = new MetaTile( F_outline, null, [0,0,0] );
	meta.width = 2;

	meta.addChild( 
		[0.5, 0, 1.5, 0, 0.5, hr3],
		F_hat );
	meta.addChild( 
		mul( ttrans( 0, 2 * hr3 ), 
			mul( [0.5, hr3, 0, -hr3, 0.5, 0],
				 [0.5, 0.0, 0.0, 0.0, 0.5, 0.0] ) ),
		F_hat );

	return meta; }());

function constructPatch( H, T, P, F )
{
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

	ret = new MetaTile( [], H.width );
	shapes = { 'H' : H, 'T' : T, 'P' : P, 'F' : F };

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

	return ret;
}

function constructMetatiles( patch )
{
	const bps1 = patch.evalChild( 8, 2 );
	const bps2 = patch.evalChild( 21, 2 );
	const rbps = transPt( rotAbout( bps1, -2.0*PI/3.0 ), bps2 );

	const p72 = patch.evalChild( 7, 2 );
	const p252 = patch.evalChild( 25, 2 );

	const llc = intersect( bps1, rbps,
		patch.evalChild( 6, 2 ), p72 );
	let w = psub( patch.evalChild( 6, 2 ), llc );

	const new_H_outline = [llc, bps1];
	w = transPt( trot( -PI/3 ), w );
	new_H_outline.push( padd( new_H_outline[1], w ) );
	new_H_outline.push( patch.evalChild( 14, 2 ) );
	w = transPt( trot( -PI/3 ), w );
	new_H_outline.push( psub( new_H_outline[3], w ) );
	new_H_outline.push( patch.evalChild( 6, 2 ) );

	const new_H = new MetaTile( new_H_outline, patch.width * 2 );
	for( let ch of [0, 9, 16, 27, 26, 6, 1, 8, 10, 15] ) {
		new_H.addChild( patch.children[ch].T, patch.children[ch].geom );
	}

	const new_P_outline = [ p72, padd( p72, psub( bps1, llc ) ), bps1, llc ];
	const new_P = new MetaTile( new_P_outline, patch.width * 2 );
	for( let ch of [7,2,3,4,28] ) {
		new_P.addChild( patch.children[ch].T, patch.children[ch].geom );
	}

	const new_F_outline = [ 
		bps2, patch.evalChild( 24, 2 ), patch.evalChild( 25, 0 ),
		p252, padd( p252, psub( llc, bps1 ) ) ];
	const new_F = new MetaTile( new_F_outline, patch.width * 2 );
	for( let ch of [21,20,22,23,24,25] ) {
		new_F.addChild( patch.children[ch].T, patch.children[ch].geom );
	}
	
	const AAA = new_H_outline[2];
	const BBB = padd( new_H_outline[1], 
		psub( new_H_outline[4], new_H_outline[5] ) );
	const CCC = transPt( rotAbout( BBB, -PI/3 ), AAA );
	const new_T_outline = [BBB,CCC,AAA];
	const new_T = new MetaTile( new_T_outline, patch.width * 2 );
	new_T.addChild( patch.children[11].T, patch.children[11].geom );

	new_H.recentre();
	new_P.recentre();
	new_F.recentre();
	new_T.recentre();

	return [new_H, new_T, new_P, new_F]
}

function isButtonActive( but )
{
	return but.elt.style.border.length > 0;
}

function setButtonActive( but, b )
{
	but.elt.style.border = (b ? "3px solid black" : "");
}

function addButton( name, f )
{
	const ret = createButton( name );
	ret.position( 10, box_height );
	ret.size( 125, 25 );
	ret.mousePressed( f );
	box_height += 30;

	return ret;
}

function setup() {
	createCanvas( windowWidth, windowHeight );

	tiles = [H_init, T_init, P_init, F_init];
        level = 1;
        truchetTop = truchetTopFromHat( hat_outline );
        truchetBtm = truchetBtmFromHat( hat_outline );


	black = color( 'black' );

	reset_button = addButton( "Reset", function() {
		tiles = [H_init, T_init, P_init, F_init];
		level = 1;
		radio.selected( 'H' );
		to_screen = [20, 0, 0, 0, -20, 0];
		lw_scale = 1;
		setButtonActive( draw_hats, true );
		setButtonActive( draw_super, true );
		loop();
	} );
	subst_button = addButton( "Build Supertiles", function() {
		const patch = constructPatch( ...tiles );
		tiles = constructMetatiles( patch );
		++level;
		loop();
	} );
	box_height += 10;

	radio = createRadio();
	radio.mousePressed( function() { loop() } );
	radio.position( 10, box_height );
	for( let s of ['H', 'T', 'P', 'F'] ) {
		let o = radio.option( s );
		o.onclick = loop;
	}
	radio.selected( 'H' );
	box_height += 40;

	const cp_info = {
	    'H1' : [0, 137, 212],
	    'H' : [148, 205, 235],
	    'T' : [251, 251, 251],
	    'P' : [250, 250, 250],
	    'F' : [191, 191, 191],
	    'Plane' : [255, 255, 255],
	    'Truchet' : [0, 189, 107],	   
	    'Stroke' : [0, 0, 0]
	};

	let count = 0;
	for( let [name, col] of Object.entries( cp_info ) ) {
		const label = createSpan( name );
		label.position( 10 + 70*count, box_height );
		const cp = createColorPicker( color( ...col ) );
		cp.mousePressed( function() { loop() } );
		cp.position( 10 + 70*count, box_height + 20 );
		cols[name] = cp;
		
		++count;
		if( count == 2 ) {
		count = 0;
		box_height += 50;
		}
	}
	if( count == 1 ) {
		box_height += 50;
	}
	box_height += 20;

	strokeCheckbox = createCheckbox('',true);
	cols["Stroke"].size(32);
        strokeCheckbox.position(cols["Stroke"].x +cols["Stroke"].width , cols["Stroke"].y-3);
	
	truchetCheckbox = createCheckbox('',false);
	cols["Truchet"].size(32);
	truchetCheckbox.position(cols["Truchet"].x +cols["Truchet"].width , cols["Truchet"].y-3);

	translate_button = addButton( "Translate", function() {
		setButtonActive( translate_button, true );
		setButtonActive( scale_button, false );
		loop();
	} );
	scale_button = addButton( "Scale", function() {
		setButtonActive( translate_button, false );
		setButtonActive( scale_button, true );
		loop();
	} );

	setButtonActive( translate_button, true );
	box_height += 10;
	
	draw_hats = addButton( "Draw Hats", function() {
		setButtonActive( draw_hats, !isButtonActive( draw_hats ) );
		loop();
	} );
	draw_super = addButton( "Draw Supertiles", function() {
		setButtonActive( draw_super, !isButtonActive( draw_super ) );
		loop();
	} );

	setButtonActive( draw_hats, true );
	setButtonActive( draw_super, true );
	box_height += 10;

	addButton( "Save PNG", function () {
		uibox = false;
		draw();
		save( "output.png" );
		uibox = true;
		draw();
	} );

	addButton( "Save SVG", function () {
		svg_serial = 0;
		for( let t of tiles ) {
			t.resetSVG();
		}

		const stream = [];
		stream.push( `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` );
		stream.push( '<defs>' );
		for( let t of tiles ) {
			t.buildSVGDefs( stream, mag( to_screen[0], to_screen[1] ),
				truchetCheckbox.checked(), strokeCheckbox.checked() );
		}
		stream.push( '</defs>' );

		const idx = {'H':0, 'T':1, 'P':2, 'F':3}[radio.value()];
		const S = mul( ttrans( width/2, height/2 ), to_screen );

		if( isButtonActive( draw_hats ) ) {
			stream.push( getSVGInstance( tiles[idx].getSVGFillID(), S ) );
		}
		if( isButtonActive( draw_super ) ) {
			stream.push( getSVGInstance( tiles[idx].getSVGStrokeID(), S ) );
		}
		stream.push( '</svg>' );

		saveStrings( stream, 'output', 'svg' );
	} );

	addButton( "Save Matrices", function() {
		const stream = [];
		const idx = {'H':0, 'T':1, 'P':2, 'F':3}[radio.value()];
		tiles[idx].getText( stream, ident );
		saveStrings( stream, 'output', 'txt' );
	} );

	box_height -= 5; // remove half the padding
}

function draw()
{
	background( cols["Plane"].color() );

	push();
	translate( width/2, height/2 );
	const idx = {'H':0, 'T':1, 'P':2, 'F':3}[radio.value()];

	if( isButtonActive( draw_hats ) ) {
		tiles[idx].draw( to_screen, level, truchetCheckbox.checked(), strokeCheckbox.checked() );
	}

	if( isButtonActive( draw_super ) ) {
		for( let lev = level - 1; lev >= 0; --lev ) {
			tiles[idx].draw( to_screen, lev );
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
