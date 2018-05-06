window.terafm = window.terafm || {};
terafm.recoveryDialogController = {};

(function(recoveryDialogController, recoveryDialog, db, help, editableManager, options, keyboardShortcuts, initHandler) {
	'use strict';

	let vue;

	// Key comobo to open/close diag
	initHandler.onInit(function() {
		if(options.get('keybindEnabled')) {
			keyboardShortcuts.on(options.get('keybindToggleRecDiag'), function() {
				if(!vue) return build();
				if(vue.visible) {
					vue.hide();
				} else {
					vue.show();
				}
			});
		}

		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
			if(request.action === 'openRecoveryDialog') show();
		});
	});

	recoveryDialogController.open = () => show();

	function show() {
		if(vue) {
			vue.show();
		} else {
			build();
		}
	}

	function build(callback) {
		if(!vue) {
			terafm.ui.inject({
				html: '<div id="tmp-dialog-holder"></div>',
				returnNode: '#tmp-dialog-holder'
			}, function(rootnode) {
				makeVue(rootnode, callback);
			});
		} else {
			if(callback) callback();
		}
	}

	function makeVue(rootnode, callback) {

		import( chrome.runtime.getURL('../templates/dialog.js') ).then((module) => {

			vue = new Vue({
				...(module),
				el: rootnode,
				methods: {
					hide: function() {
						this.visible = false;
					},
					backgroundClickHide: function(e) {
						if(e.path[0].classList.contains('modal-container')) this.hide();
					},
					show: function() {
						if(this.visible) return;
						this.visible = true;
						this.populate();
					},
					setEntry: function(e) {
						let target = e.path[0];
						if(!target.matches('li')) target = target.closest('li');

						this.currEntry = this.sesslist.getEntry(target.dataset.sessionId, target.dataset.editableId);
						this.page = 'entry';

						if(this.selectedListItem) this.selectedListItem.classList.remove('selected');
						this.selectedListItem = target;
						this.selectedListItem.classList.add('selected');
					},
					setDefaultPage: function() {
						this.currEntry = null;
						this.page = 'default';
					},

					// Callback for failures?
					restoreSession: function() {
						if(!this.currEntry) return;
						this.currEntry.getSession().restore({flash: true});
						terafm.toast.create('Session restored.');
						this.hide();
					},
					restoreEntry: function() {
						if(!this.currEntry) return;
						this.currEntry.restore({flash: true});
						terafm.toast.create('Entry restored.');
						this.hide();
					},

					populate: function(opts = {scrollTop: false}) {
						document.activeElement.blur();
						this.setDefaultPage();

						db.fetch().then(() => {
							this.sesslist = db.getSessions();

							if(this.filterSmallEntries || this.filterText.length > 2) {
								var defCount = this.sesslist.countEntries();
								this.sesslist = this.sesslist.filterEntries(entry => {
									if(entry.obj.value.toLowerCase().indexOf(this.filterText.toLowerCase()) === -1 || entry.obj.value.length < 6) return null;
								});
								this.filteredCount = defCount - this.sesslist.countEntries();
							} else {
								this.filteredCount = 0;
							}
							
							if(opts.scrollTop) this.scrollTop();
						});
					},
					scrollTop: function() {
						this.$el.querySelector('.session-data').scrollTop = 0;
					},
					updateOptsFilterSmallEntries: function() {
						this.populate();
						options.set('hideSmallEntries', this.filterSmallEntries);
					},

					deleteEntry: function(e) {
						let target = e.path[0];
						if(!target.matches('.delete')) target = target.closest('.delete');

						e.stopPropagation();

						if(!target.classList.contains('confirm')) {
							target.classList.add('confirm');
							target.querySelector('.text').innerText = 'Click to confirm';
							
							setTimeout(() => {
								target.classList.remove('confirm');
								target.querySelector('.text').innerText = 'Delete';
							}, 4000);
						} else {
							let li = target.closest('li');

							this.sesslist.deleteEntry(li.dataset.sessionId, li.dataset.editableId, () => {
								this.populate();

								// Vue will re-use other elements and change the text in them
								// instead of creating new ones, so the make sure the .confirm class
								// is removed if the li element was re-used
								let delLink = li && li.querySelector('.meta .delete.confirm');
								if(delLink) delLink.classList.remove('confirm');
							});
						}
					},

					openKeyboardShortcuts: function() {
						this.hide();
						terafm.keyboardShortcutController.showShortcutDialog();
					},

					copyEntry: function(format) {
						if(!this.currEntry) return;

						if(format === 'plaintext') {
							terafm.help.copyToClipboard(this.currEntry.getValue({stripTags: true, trim: true}));
							terafm.toast.create('Copied plaintext to clipboard.');

						} else if(format === 'formatting') {
							terafm.help.copyToClipboard(this.currEntry.getValue({trim: true}));
							terafm.toast.create('Copied text with formatting to clipboard.');
						}

					},

					openOptions: function() {
						chrome.runtime.sendMessage({action: 'openSettings'});
					},
					disableSite: function() {
						terafm.blacklist.block(window.location.hostname);
						terafm.toast.create('Typio will be disabled on the next page load.');
						this.hide();
					}
				},
				data: {
					visible: true,
					hostname: window.location.hostname,
					page: 'default',
					selectedListItem: null,

					sesslist: false,
					currEntry: null,

					filteredCount: 0,
					filterSmallEntries: options.get('hideSmallEntries'),
					filterText: '',
				},
				mounted: function() {
					this.populate();
				}
			});


			keyboardShortcuts.on(['Escape'], function() {
				vue.hide();
			});

			if(callback) callback();
		})
	}

})(terafm.recoveryDialogController, terafm.recoveryDialog, terafm.db, terafm.help, terafm.editableManager, terafm.options, terafm.keyboardShortcuts, terafm.initHandler);