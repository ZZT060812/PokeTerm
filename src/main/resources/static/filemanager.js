// File tree manager with lazy loading
const FileManager = {
    currentPath: '.',
    contextTarget: null,
    pendingAction: null,
    pendingContainer: null,

    init() {
        this._loadTree('.');
        this._bindEvents();
    },

    _bindEvents() {
        document.addEventListener('click', () => {
            document.getElementById('context-menu').style.display = 'none';
        });
        document.querySelectorAll('.ctx-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                document.getElementById('context-menu').style.display = 'none';
                this._handleAction(action, this.contextTarget);
            });
        });

        document.getElementById('editor-close').addEventListener('click', () => {
            document.getElementById('editor-modal').style.display = 'none';
        });
        document.getElementById('editor-save').addEventListener('click', () => {
            const path = document.getElementById('editor-path').dataset.path;
            const content = document.getElementById('editor-content').value;
            App.send({ type: 'fs.write', path: path, content: content });
            document.getElementById('editor-modal').style.display = 'none';
        });

        document.getElementById('new-close').addEventListener('click', () => {
            document.getElementById('new-modal').style.display = 'none';
        });
        document.getElementById('new-create').addEventListener('click', () => {
            const name = document.getElementById('new-name').value.trim();
            if (!name) return;
            const parentPath = this.pendingAction === 'new-file'
                ? this.contextTarget.path : this.contextTarget;
            const fullPath = parentPath.endsWith('/') ? parentPath + name : parentPath + '/' + name;
            if (this.pendingAction === 'new-file') {
                App.send({ type: 'fs.write', path: fullPath.replace('./', ''), content: '' });
            } else {
                App.send({ type: 'fs.mkdir', path: fullPath.replace('./', '') });
            }
            document.getElementById('new-modal').style.display = 'none';
            setTimeout(() => this._loadTree(this.currentPath), 300);
        });

        // Long-press for mobile context menu
        let longPressTimer;
        document.getElementById('file-tree').addEventListener('touchstart', (e) => {
            const row = e.target.closest('.tree-row');
            if (!row) return;
            longPressTimer = setTimeout(() => {
                this._showContextMenu(row, e.touches[0].clientX, e.touches[0].clientY);
            }, 500);
        });
        document.getElementById('file-tree').addEventListener('touchend', () => clearTimeout(longPressTimer));
        document.getElementById('file-tree').addEventListener('touchmove', () => clearTimeout(longPressTimer));

        // Click terminal area closes mobile sidebar
        document.getElementById('terminal-container').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });
    },

    _loadTree(path) {
        this.currentPath = path;
        App.send({ type: 'fs.list', path: path });
    },

    onList(msg) {
        const files = msg.files || [];
        const path = msg.path || '.';

        // Subdirectory lazy-load response
        if (this.pendingContainer && path !== '.' && path !== this.currentPath) {
            const container = this.pendingContainer;
            this.pendingContainer = null;
            // Infer parent depth from the container's parent row
            const parentRow = container.closest('.tree-node')?.querySelector('.tree-row');
            const childDepth = parentRow ? (parseInt(parentRow.dataset.depth) || 0) + 1 : 1;
            container.innerHTML = '';
            files.forEach(f => {
                const fullPath = path + '/' + f.name;
                container.appendChild(this._createNode(fullPath, f.isDir, false, childDepth));
            });
            return;
        }

        // Root / current directory reload
        const tree = document.getElementById('file-tree');
        if (path === '.' || path === this.currentPath) {
            tree.innerHTML = '';
            const rootEl = this._createNode('.', true, true, 0);
            tree.appendChild(rootEl);
            const children = rootEl.querySelector('.tree-children');
            children.classList.add('open');
            files.forEach(f => {
                const childPath = path === '.' ? f.name : path + '/' + f.name;
                children.appendChild(this._createNode(childPath, f.isDir, false, 1));
            });
        }
    },

    _createNode(path, isDir, isRoot, depth) {
        const node = document.createElement('div');
        node.className = 'tree-node';

        const row = document.createElement('div');
        row.className = 'tree-row';
        row.dataset.path = path;
        row.dataset.isDir = isDir;
        row.dataset.depth = depth;
        // Each level indented 16px, root starts at 12px
        row.style.paddingLeft = (12 + depth * 16) + 'px';

        const arrow = document.createElement('span');
        arrow.className = 'tree-arrow';
        arrow.textContent = isDir ? '▶' : ' ';
        row.appendChild(arrow);

        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.textContent = isDir ? '📁' : '📄';
        row.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = isRoot ? '/' : path.split('/').pop();
        row.appendChild(name);

        row.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.tree-row.selected').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');

            if (isDir) {
                this._toggleDir(row);
            } else {
                App.send({ type: 'fs.read', path: path });
            }
        });

        row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._showContextMenu(row, e.clientX, e.clientY);
        });

        node.appendChild(row);

        const children = document.createElement('div');
        children.className = 'tree-children';
        node.appendChild(children);

        // Directories are loaded lazily — no eager fs.list here
        if (isDir) {
            row._childrenLoaded = false;
        }

        return node;
    },

    _toggleDir(row) {
        const arrow = row.querySelector('.tree-arrow');
        const children = row.parentElement.querySelector('.tree-children');
        if (!children) return;

        const isOpen = children.classList.toggle('open');
        arrow.classList.toggle('open', isOpen);

        // Lazy load: only fetch when expanding for the first time
        if (isOpen && !row._childrenLoaded) {
            const path = row.dataset.path;
            row._childrenLoaded = true;
            children.innerHTML = '<div class="tree-loading">...</div>';
            this.pendingContainer = children;
            App.send({ type: 'fs.list', path: path });
        }

        if (window.innerWidth <= 768) {
            setTimeout(() => document.getElementById('sidebar').classList.remove('open'), 200);
        }
    },

    onRead(msg) {
        const editorModal = document.getElementById('editor-modal');
        const pathEl = document.getElementById('editor-path');
        const contentEl = document.getElementById('editor-content');
        const truncatedEl = document.getElementById('editor-truncated');

        pathEl.textContent = msg.path;
        pathEl.dataset.path = msg.path;
        contentEl.value = msg.content || '';
        truncatedEl.style.display = msg.truncated ? 'inline' : 'none';
        editorModal.style.display = 'flex';
        contentEl.focus();
    },

    onResult(msg) {
        if (msg.ok) {
            this._loadTree(this.currentPath);
        } else {
            alert('Operation failed: ' + (msg.error || 'Unknown error'));
        }
    },

    _showContextMenu(row, x, y) {
        const menu = document.getElementById('context-menu');
        this.contextTarget = {
            path: row.dataset.path,
            isDir: row.dataset.isDir === 'true'
        };
        menu.querySelector('[data-action="delete"]').style.display = 'block';
        menu.querySelector('[data-action="download"]').style.display =
            this.contextTarget.isDir ? 'none' : 'block';
        menu.style.display = 'block';
        menu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
        menu.style.top = Math.min(y, window.innerHeight - 160) + 'px';
    },

    _handleAction(action, target) {
        if (!target) return;
        switch (action) {
            case 'new-file':
                this.pendingAction = 'new-file';
                document.getElementById('new-label').textContent = 'New File';
                document.getElementById('new-name').value = '';
                document.getElementById('new-modal').style.display = 'flex';
                break;
            case 'new-dir':
                this.pendingAction = 'new-dir';
                document.getElementById('new-label').textContent = 'New Folder';
                document.getElementById('new-name').value = '';
                document.getElementById('new-modal').style.display = 'flex';
                break;
            case 'delete':
                if (confirm('Delete ' + target.path + '?')) {
                    App.send({ type: 'fs.delete', path: target.path });
                }
                break;
            case 'download':
                App.send({ type: 'fs.read', path: target.path });
                break;
        }
    }
};
