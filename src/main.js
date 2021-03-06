var config = {
	apiKey: 'AIzaSyCwAPZxgorwuqX_7gku1XD1UY3YbUyPbq4',
	authDomain: 'mismith.firebaseapp.com',
	databaseURL: 'https://mismith.firebaseio.com',
	projectId: 'firebase-mismith',
	storageBucket: 'firebase-mismith.appspot.com',
	messagingSenderId: '668345313266'
};
firebase.initializeApp(config);

function mapInOrder(obj, callback, context) {
	return Object.keys(obj).sort((a,b) => a < b ? -1 : 1).map(k => callback.call(context || this, obj[k], k));
}

let Swipeable = React.createClass({
	getInitialState() {
		return {
			start: 0,
			x: null,
			y: null,
			swiping: false,
		};
	},
	getDefaultProps() {
		return {
			threshold: 10,
		};
	},

	handleStart(e) {
		let touch = e.touches && e.touches.length,
			x = (touch ? e.touches[0] : e).clientX,
			y = (touch ? e.touches[0] : e).clientY;

		this.setState({
			start: Date.now(),
			x,
			y,
		});

		document.addEventListener(touch ? 'touchmove' : 'mousemove', this.handleMove);
		document.addEventListener(touch ? 'touchend' : 'mouseup',  this.handleEnd);
	},
	handleMove(e) {
		let touch = e.touches && e.touches.length,
			x = (touch ? e.touches[0] : e).clientX,
			y = (touch ? e.touches[0] : e).clientY;

		if (Math.max(Math.abs(y - this.state.y), Math.abs(x - this.state.x)) > this.props.threshold) {
			this.setState({
				swiping: true,
			});
		}
	},
	handleEnd(e) {
		let touch = e.changedTouches && e.changedTouches.length,
			x = (touch ? e.changedTouches[0] : e).clientX,
			y = (touch ? e.changedTouches[0] : e).clientY;

		if (this.state.swiping) {
			if (x - this.state.x < -this.props.threshold) {
				this.props.onSwipeLeft && this.props.onSwipeLeft(e);
			} else if (x - this.state.x > this.props.threshold) {
				this.props.onSwipeRight && this.props.onSwipeRight(e);
			} else if (y - this.state.y < -this.props.threshold) {
				this.props.onSwipeUp && this.props.onSwipeUp(e);
			} else if (y - this.state.y > this.props.threshold) {
				this.props.onSwipeDown && this.props.onSwipeDown(e);
			}
		}

		this.setState(this.getInitialState());

		document.removeEventListener(touch ? 'touchmove' : 'mousemove', this.handleMove);
		document.removeEventListener(touch ? 'touchend' : 'mouseup',  this.handleEnd);
	},

	render() {
		return <div {...this.props} onMouseDown={this.handleStart} onTouchStart={this.handleStart}>
			{this.props.children}
		</div>
	},
});


let Defaults = {};
Defaults.tiles = function(overrides = {}){
	return _.defaultsDeep(overrides, {
		a: null,
		b: null,
		c: null,
		d: null,
		e: null,
		f: null,
		g: null,
		h: null,
		i: null,
	});
}
Defaults.boards = function(overrides = {}){
	return _.defaultsDeep(overrides, {
		A: {
			tiles: Defaults.tiles(),
		},
		B: {
			tiles: Defaults.tiles(),
		},
		C: {
			tiles: Defaults.tiles(),
		},
		D: {
			tiles: Defaults.tiles(),
		},
		E: {
			tiles: Defaults.tiles(),
		},
		F: {
			tiles: Defaults.tiles(),
		},
		G: {
			tiles: Defaults.tiles(),
		},
		H: {
			tiles: Defaults.tiles(),
		},
		I: {
			tiles: Defaults.tiles(),
		},
	});
}
Defaults.game = function(overrides = {}){
	return _.defaultsDeep(overrides, {
		boards: Defaults.boards(),
		turns: [],
		canChooseAnyTile: null,
		turn: 'blue',
		blue: 'x',
		red: 'o',
	});
}



let TicTools = React.createClass({
	mixins: [
		ReactFireMixin,
	],
	getInitialState() {
		return {
			loading: true,
			me:      null,
			games:   [],
			gameRef: null,
		};
	},

	componentWillMount() {
		this.firebase = firebase.database().ref('tic-tools');
		firebase.auth().onAuthStateChanged(authData => {
			if (authData) {
				// user profile
				let meRef = this.firebase.child('users').child(authData.uid);
				meRef.update({
					...authData[authData.provider],
					uid: authData.uid,
				});

				this.bindAsObject(meRef, 'me');

				// online presence
				this.firebase.root.child('.info/connected').on('value', snap => {
					if (snap.val()) {
						meRef.child('online').onDisconnect().set(new Date().toISOString());
						meRef.child('online').set(true);
					}
				});

				// games
				let gamesRef = this.firebase.child('users:games').child(authData.uid);
				this.bindAsArray(gamesRef, 'games');
				gamesRef.once('value').then(snap => {
					this.setState({
						loading: false,
					});
				});

				// load most recent game (or a new one, if none found)
				meRef.once('value').then(snap => {
					this.setState({
						gameRef: gamesRef.child(snap.val().gameId || gamesRef.push().key),
					});
				});
			} else {
				// @TODO: clean up all firebase stuff
				this.setState(this.getInitialState());
				this.setState({loading: false});
			}
		});
	},

	login() {
		this.setState({loading: true});
		firebase.auth().signInWithRedirect(new firebase.auth.FacebookAuthProvider());
	},
	logout() {
		firebase.auth().signOut();
		location.reload(); // @HACK
	},

	createGame(gameData) {
		this.pickGame(null, () => this.state.gameRef.update(gameData));
	},
	pickGame(gameId, callback) {
		if (!this.firebaseRefs.games) return alert('You must login first.');
		if (!gameId) gameId = this.firebaseRefs.games.push().key;

		if (this.firebaseRefs.me) {
			this.firebaseRefs.me.update({
				gameId: gameId,
			});
		}
		this.setState({
			loading: false,
			gameRef: this.firebaseRefs.games.child(gameId),
		}, callback);
	},
	deleteGame(gameId) {
		if (!gameId) return;

		this.firebaseRefs.games.child(gameId).remove();

		this.pickGame(); // go to new game
	},

	render() {
		return <div id="container" className={this.state.loading ? 'loading' : ''}>
			<div id="game">
				<Game gameRef={this.state.gameRef} me={this.state.me} />
			</div>
			<aside id="sidebar">
				<ul className="gameitems">
				{!this.state.me && 
					<li className="gameitem new facebook" onClick={this.login}>
						<div className="flex-row flex-grow">
							<figure>
								<img src="icons/facebook.svg" />
							</figure>
							<div className="flex-grow flex-row">
								<div className="swipeable">Login with Facebook</div>
							</div>
						</div>
					</li>
				}
				{this.state.me &&
					<li className="gameitem new">
						<div className="flex-row flex-grow">
							<figure>
								<img src="icons/plus.svg" />
							</figure>
							<div className="flex-grow flex-row">
								<div className="swipeable">Import Screenshot</div>
							</div>
							<ImageScanner onImageChange={e => this.setState({loading: true})} onImageScanned={gameData => this.createGame(gameData)} />
						</div>
					</li>
				}
				{this.state.me &&
					<li className="gameitem new" onClick={this.pickGame.bind(this, null, null)}>
						<div className="flex-row flex-grow">
							<figure>
								<img src="icons/plus.svg" />
							</figure>
							<div className="flex-grow flex-row">
								<div className="swipeable">New Game</div>
							</div>
						</div>
					</li>
				}
				{this.state.games.sort((a, b) => (a.updated || a.created) > (b.updated || b.created) ? -1 : 1).map(game =>
					<GameItem key={game['.key']} game={game} isActive={this.state.gameRef && this.state.gameRef.key === game['.key']} onClick={e => this.pickGame(game['.key'])} onDelete={e => this.deleteGame(game['.key'])} />
				)}
				{this.state.me && 
					<li className="gameitem new red" onClick={this.logout}>
						<div className="flex-row flex-grow">
							<figure>
								<img src="icons/logout.svg" />
							</figure>
							<div className="flex-grow flex-row">
								<div className="swipeable">Logout</div>
							</div>
						</div>
					</li>
				}
				</ul>
			</aside>
			<div className="loader">
				<img src="loading.svg" />
			</div>
		</div>
	},
});

let GameItem = React.createClass({
	getDefaultProps() {
		return {
			game: {},
		};
	},
	getInitialState() {
		return {
			deleting: false,
		};
	},

	render() {
		let {game, isActive, className, ...props} = this.props;

		return <li {...props} className={`gameitem ${isActive ? 'active' : ''} ${this.state.deleting ? 'deleting' : ''} ${className}`}>
			<figure>
				<MegaBoard {...game} className="mini" />
			</figure>
			<div className="flex-grow flex-row">
				<Swipeable className="swipeable" threshold={200} onSwipeLeft={e => this.setState({deleting: true})} onSwipeRight={e => this.setState({deleting: false})}>
					<div className="flex-grow flex-column flex-justify-center">
						<span>{game.opponent || 'Opponent'}</span>
						<time datetime={game.updated || game.created} title={game.updated || game.created}>
							{moment(game.updated || game.created).fromNow()}
						</time>
					</div>
					<button className="btn delete" onClick={this.props.onDelete}>Delete</button>
				</Swipeable>
			</div>
		</li>
	},
});


let Game = React.createClass({
	mixins: [
		ReactFireMixin,
	],
	getInitialState() {
		return {
			game: Defaults.game(),
			t: -1,
		};
	},

	componentWillMount() {
		if (this.props.gameRef) {
			this.bindAsObject(this.props.gameRef, 'game');
		}
	},
	componentWillReceiveProps(nextProps) {
		if (this.props.gameRef !== nextProps.gameRef) {
			if (this.firebaseRefs.game) this.unbind('game');
			if (nextProps.gameRef) {
				this.setState(this.getInitialState());
				this.bindAsObject(nextProps.gameRef, 'game');
			}
		}
	},

	handleCancel() {
		if (!this.props.gameRef) return;
		
		this.unbind('game');
		this.setState(this.getInitialState());
		this.bindAsObject(this.props.gameRef, 'game');
	},
	handleSave() {
		if (!this.props.gameRef) return;

		let game = Object.assign({}, this.state.game);
		game[game.created ? 'updated' : 'created'] = new Date().toISOString();
		delete game['.key'];
		delete game['.value'];
		delete game.$dirty;

		this.props.gameRef.update(game);
	},

	handleClick(i, j, player, previous, e) {
		if (!this.props.gameRef) return alert('You must login first.');

		// @TODO: check/confirm if allowed
		let game = Defaults.game(this.state.game);

		if (e.altKey) {
			// force set/toggle tile
			e.preventDefault();

			let newPlayer = e.type === 'contextmenu' ? 'red' : 'blue';
			if (game.boards[i].tiles[j] === newPlayer) newPlayer = null;

			game.boards[i].tiles[j] = newPlayer;
		} else {
			if (this.state.t >= 0) {
				var removedTurns = game.turns.splice(this.state.t);

				removedTurns.map(turn => {
					let [i, j] = turn;
					game.boards[i].tiles[j] = null;
				});

				this.state.t = -1;
			}

			// make a turn
			game.canChooseAnyTile = null;
			if (previous) {
				let J = j.toUpperCase(),
					tilesLeftInDestinationBoard = _.filter(game.boards[J].tiles, tile => !tile).length;

				if (
					!tilesLeftInDestinationBoard || // board is already full
					J === i && tilesLeftInDestinationBoard <= 1 // took last tile in own board
				) {
					game.canChooseAnyTile = true;
				}
			}
			game.boards[i].tiles[j] = game.turn;
			game.turns.push(i + j);
			game.turn = game.turn === 'blue' ? 'red' : 'blue';
		}
		game.$dirty = true;
		this.setState({game});
	},

	render() {
		let {me, className, ...props} = this.props,
			game = Defaults.game(this.state.game),
			{boards: origBoards, turns: origTurns, ...gameData} = game;

		let t        = this.state.t < 0 ? origTurns.length : this.state.t,
			turns    = origTurns.slice(0, Math.max(1, Math.min(t, origTurns.length))),
			previous = turns[turns.length - 1],
			boards   = Defaults.boards();

		// only show tiles up to active turn
		_.map(origBoards, (board, i) => {
			_.map(board.tiles, (tile, j) => {
				boards[i].tiles[j] = origTurns.indexOf(i + j) < 0 ? tile : (turns.indexOf(i + j) >= 0 ? tile : false);
			});
		});

		return <div className={`gameview ${className}`}>
			<header>
				<div>
					<span className="btn mini avatar blue" style={{backgroundImage: `url(${me ? me.profileImageURL : 'avatar.svg'})`}}></span>
					<output>{me ? me.displayName.replace(/([A-Z])[a-z]*?$/, '$1.') : 'You'}</output>
				</div>
				<Tile className="turn-indicator btn" player={game.turn} letter={game.turn === 'blue' ? game.blue : game.red} onClick={e => this.setState({game: {...game, blue: game.red, red: game.blue}})} />
				<div>
					<input value={game.opponent || ''} placeholder="Opponent" size="8" onChange={e => this.setState({game: {...game, opponent: e.target.value, $dirty: true}})} />
					<span className="btn mini avatar red" style={{backgroundImage: `url(avatar.svg)`}}></span>
				</div>
			</header>
			<MegaBoard {...gameData} boards={boards} previous={previous} onClick={this.handleClick} />
			<footer>
				<div>
					<button className="btn red" disabled={!game.$dirty || !game.opponent || !me} onClick={this.handleCancel}>
						<img src="icons/cancel.svg" height="36" />
					</button>
				</div>
				<div>
					<button disabled={t <= 1} className="btn" onClick={e => this.setState({t: t - 1, game: {...game, turn: game.turn === 'blue' ? 'red' : 'blue'}})}><img src="icons/chevron-left.svg" height="36" /></button>
					<output>{t} / {origTurns.length}</output>
					<button disabled={t >= origTurns.length} className="btn" onClick={e => this.setState({t: t + 1, game: {...game, turn: game.turn === 'blue' ? 'red' : 'blue'}})}><img src="icons/chevron-right.svg" height="36" /></button>
				</div>
				<div>
					<button className="btn green" disabled={!game.$dirty || !game.opponent || !me} onClick={this.handleSave}>
						<img src="icons/check.svg" height="32" />
					</button>
				</div>
			</footer>
		</div>
	},
});

let MegaBoard = React.createClass({
	getDefaultProps() {
		return {
			boards: Defaults.boards(),
		};
	},

	render() {
		let {boards, className, ...props} = this.props;
		boards = Defaults.boards(boards);

		return <div className={`megaboard ${className}`}>
		{mapInOrder(boards, (board, i) =>
			<Board key={i} {...props} i={i} tiles={board.tiles} />
		)}
		</div>
	},
});

let Board = React.createClass({
	getDefaultProps() {
		return {
			tiles: Defaults.tiles(),
			i: 'A',
			previous: null,
			blue: 'x',
			red: 'o',
			onClick: () => {},
		};
	},

	getClassName() {
		let className = '',
			tiles = Defaults.tiles(this.props.tiles);

		if (
			// rows
			(tiles.a === tiles.b && tiles.b === tiles.c && (className = tiles.c || '')) ||
			(tiles.d === tiles.e && tiles.e === tiles.f && (className = tiles.f || '')) ||
			(tiles.g === tiles.h && tiles.h === tiles.i && (className = tiles.i || '')) ||

			// cols
			(tiles.a === tiles.d && tiles.d === tiles.g && (className = tiles.g || '')) ||
			(tiles.b === tiles.e && tiles.e === tiles.h && (className = tiles.h || '')) ||
			(tiles.c === tiles.f && tiles.f === tiles.i && (className = tiles.i || '')) ||

			// diag
			(tiles.a === tiles.e && tiles.e === tiles.i && (className = tiles.i || '')) ||
			(tiles.c === tiles.e && tiles.e === tiles.g && (className = tiles.g || ''))
		) {
			// this board has been won
			// (player/winner sets className inline above)
		} else if (_.filter(tiles, tile => !tile).length === 0) {
			// no active tiles left
			// it's a tie --> make this a wildcard
			className += ' purple';
		}

		if (
			this.props.canChooseAnyTile || 
			(this.props.previous && this.props.previous[1].toUpperCase() === this.props.i)
		) {
			className += ' active';
		}

		return className;
	},

	render() {
		let {i, tiles, canChooseAnyTile, previous, blue, red, onClick, ...props} = this.props,
			zIndex = 0;
		tiles = Defaults.tiles(tiles);

		return <div className={`board ${this.getClassName()}`}>
		{mapInOrder(tiles, (tile, j) =>
			<Tile
				key={j}
				{...props}
				player={tile || null}
				letter={tile === 'blue' ? blue : (tile === 'red' ? red : false)}
				isPrevious={i + j === previous}
				isBlocked={
					j.toUpperCase() + i.toLowerCase() === previous && // can't send back
					_.filter(tiles, tile2 => !tile2).length > 1 // don't block if only one left
				}
				onClick={onClick.bind(null, i, j, tile, previous)}
				style={{zIndex: 3-zIndex++%3}}
			/>
		)}
		</div>
	},
});

let Tile = React.createClass({
	getDefaultProps() {
		return {
			player: 'blue',
			letter: 'x',
		};
	},

	render() {
		let {player, letter, isPrevious, isBlocked, className, ...props} = this.props;

		return <span {...props} className={`tile ${player || 'none'} ${isPrevious ? 'previous' : ''} ${isBlocked ? 'blocked' : ''} ${className}`} onContextMenu={this.props.onClick}>
		{letter &&
			<img src={`icons/${letter}.svg`} />
		}
		</span>
	},
});


let ImageScanner = React.createClass({
	getDefaultProps() {
		return {
			onImageChange: file => {},
			onImageScanned: gameData => {},
		};
	},
	scanImage(img) {
		try {
			if (!img.width || !img.height) throw new Error('Invalid image');

			var c   = document.createElement('canvas'),
				ctx = c.getContext('2d');
			c.width = img.width;
			c.height = img.height;

			ctx.drawImage(img, 0, 0);

			let getPixel = {
				x: (i, j) => ctx.getImageData(74 + j*74 + (j >= 6 ? 11 : (j >= 3 ? 5 : 0)), 436 + i*74 + (i >= 6 ? 11 : (i >= 3 ? 5 : 0)), 1, 1).data || [],
				o: (i, j) => ctx.getImageData(56 + j*74 + (j >= 6 ? 11 : (j >= 3 ? 5 : 0)), 436 + i*74 + (i >= 6 ? 11 : (i >= 3 ? 5 : 0)), 1, 1).data || [],
			};

			// scan pixel grid
			let pixels = {};
			for (var i = 0; i < 9; i++) {
				pixels[i] = {};
				for (var j = 0; j < 9; j++) {
					var x = getPixel.x(i, j),
						o = getPixel.o(i, j);
					if (x[0] === x[1] && x[1] === x[2] && x[2] === x[3]) {
						// claimed X
						pixels[i][j] = {letter: 'x', color: o};
					} else if (o[0] === o[1] && o[1] === o[2] && o[2] === o[3]) {
						// claimed O
						pixels[i][j] = {letter: 'o', color: x};
					} else {
						// gray tile / unclaimed
						pixels[i][j] = {letter: x[0] === x[1] && x[1] === x[2] ? false : null, color: null};
					}
				}
			}

			// transpose into board structure and confirm team colors
			let boards = Defaults.boards(),
				Is = 'ABCDEFGHI',
				Js = 'abcdefghi',
				teams = {x: 'red', o: 'blue', $confirmed: false};
			for (i in pixels) {
				for (var j in pixels[i]) {
					let I = Is[Math.floor(i / 3) * 3 + Math.floor(j / 3)],
						J = Js[(i % 3) * 3 + j % 3];

					boards[I].tiles[J] = pixels[i][j];

					if (pixels[i][j].letter === false && !teams.$confirmed) {
						// we've found a blank tile in an unclaimed board, so let's confirm our teams, if possible
						for (var k in boards[I].tiles) {
							if (boards[I].tiles[k] && boards[I].tiles[k].color) {
								// there's a claimed tile within the same board as the blank tile, so let's align our teams accordingly
								let color = boards[I].tiles[k].color[0] < 50 ? 'blue' : 'red';
								if (teams[boards[I].tiles[k].letter] !== color) {
									// team colors are wrong, flip em
									var tmp = teams.o;
									teams.o = teams.x;
									teams.x = tmp;
								} else {
									// team colors are right, move on
								}
								// don't check again
								teams.$confirmed = true;
								break;
							}
						}
					}
				}
			}

			// finalize boards taking team color into account
			for (i in boards) {
				for (var j in boards[i].tiles) {
					boards[i].tiles[j] = boards[i].tiles[j].letter ? teams[boards[i].tiles[j].letter] : null;
				}
			}
			return {
				created: new Date().toISOString(),
				boards,
				turn: 'red', // most of the time you'll be using this tool when you have to decide where to play, so the last player to play will have been them (i.e. red)
				blue: teams.x === 'blue' ? 'x' : 'o',
				red: teams.o === 'red' ? 'o' : 'x',
			};
		} catch(err) {
			alert(err);
		}
	},

	handleUpload(e) {
		let reader = new FileReader();
		reader.onload = e => {
			let img = new Image();
			img.src = e.target.result;

			img.onload = e => this.props.onImageScanned(this.scanImage(img));
		};
		reader.onerror = err => alert(err);
		reader.readAsDataURL(e.target.files[0]);

		this.props.onImageChange(e.target.files[0]);
	},

	render() {
		return <input type="file" accepts="image/png" onChange={this.handleUpload} />
	},
});


ReactDOM.render(
	<TicTools />,
	document.getElementById('app')
);