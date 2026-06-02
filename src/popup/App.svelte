<script lang="ts">
    import {onMount} from 'svelte';
    import {SvelteSet} from 'svelte/reactivity';

    interface LeafBookmark {
        id: string;
        title: string;
        url: string;
    }

    interface FolderNode {
        id: string;
        title: string;
        children: FolderNode[];
        bookmarks: LeafBookmark[];
    }

    interface FoundBookmark {
        id: string;
        title: string;
        url: string | undefined;
        pathNodes: { id: string; title: string }[];
    }

    let query = $state('');
    let results = $state<FoundBookmark[]>([]);
    let folderTree = $state<FolderNode[]>([]);
    let isInitialized = $state(false);

    let sidebarWidth = $state(260);
    let isResizing = $state(false);

    let expandedFolders = $state(new SvelteSet<string>());

    let allBookmarksCache: chrome.bookmarks.BookmarkTreeNode[] = [];
    let folderPathsMap = new Map<string, { id: string; title: string }[]>();

    function getFolderName(node: chrome.bookmarks.BookmarkTreeNode): string {
        if (node.title && node.title.trim() !== '') return node.title;
        if (node.id === '1') return 'Bookmarks bar';
        if (node.id === '2') return 'Other bookmarks';
        if (node.id === '3') return 'Mobile bookmarks';
        return 'Folder';
    }

    function processTree(
        nodes: chrome.bookmarks.BookmarkTreeNode[],
        currentPath: { id: string; title: string }[] = []
    ): FolderNode[] {
        const tree: FolderNode[] = [];
        if (!nodes) return tree;

        for (const node of nodes) {
            if (!node.url) {
                const name = getFolderName(node);
                const nodePath = node.id === '0' ? currentPath : [...currentPath, {
                    id: node.id,
                    title: name
                }];

                if (node.id !== '0') {
                    folderPathsMap.set(node.id, nodePath);
                }

                const subFolderNodes: chrome.bookmarks.BookmarkTreeNode[] = [];
                const currentFolderBookmarks: LeafBookmark[] = [];

                if (node.children) {
                    for (const child of node.children) {
                        if (child.url) {
                            currentFolderBookmarks.push({
                                id: child.id,
                                title: child.title || 'Untitled',
                                url: child.url
                            });
                            allBookmarksCache.push(child);
                        } else {
                            subFolderNodes.push(child);
                        }
                    }
                }

                const subFoldersParsed = processTree(subFolderNodes, nodePath);

                if (node.id !== '0') {
                    tree.push({
                        id: node.id,
                        title: name,
                        children: subFoldersParsed,
                        bookmarks: currentFolderBookmarks
                    });
                } else {
                    return subFoldersParsed;
                }
            } else {
                allBookmarksCache.push(node);
            }
        }
        return tree;
    }

    onMount(async () => {
        if (typeof chrome === 'undefined' || !chrome.bookmarks) return;
        try {
            const entireTree = await chrome.bookmarks.getTree();
            allBookmarksCache = [];
            folderPathsMap.clear();
            folderTree = processTree(entireTree);
            isInitialized = true;
        } catch (err) {
            console.error('Initialization error:', err);
        }
    });

    function toggleFolder(folderId: string) {
        if (expandedFolders.has(folderId)) {
            expandedFolders.delete(folderId);
        } else {
            expandedFolders.add(folderId);
        }
    }

    function startResize(e: MouseEvent) {
        e.preventDefault();
        isResizing = true;
        window.addEventListener('mousemove', handleResize);
        window.addEventListener('mouseup', stopResize);
    }

    function handleResize(e: MouseEvent) {
        if (!isResizing) return;
        if (e.clientX >= 180 && e.clientX <= 450) {
            sidebarWidth = e.clientX;
        }
    }

    function stopResize() {
        isResizing = false;
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', stopResize);
    }

    function onSearchInput(e: Event) {
        const target = e.target as HTMLInputElement;
        query = target.value;
        const cleanText = query.trim().toLowerCase();

        if (cleanText.length === 0) {
            results = [];
            return;
        }

        const matched = allBookmarksCache.filter(b => {
            const titleLower = (b.title || '').toLowerCase();
            const urlLower = (b.url || '').toLowerCase();
            return titleLower.includes(cleanText) || urlLower.includes(cleanText);
        });

        results = matched.map(b => ({
            id: b.id,
            title: b.title || 'Untitled',
            url: b.url,
            pathNodes: folderPathsMap.get(b.parentId || '') || []
        }));
    }

    function openInBackground(e: MouseEvent, url: string | undefined) {
        e.preventDefault();
        if (url && typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({url, active: false});
        }
    }

    function openChromeFolderInBackground(e: MouseEvent, folderId: string) {
        openInBackground(e, `chrome://bookmarks/?id=${folderId}`);
    }

    function clearSearch() {
        query = '';
        results = [];
    }
</script>

<main
        class="w-200 h-137.5 flex bg-slate-100 antialiased font-sans overflow-hidden select-none text-left"
        class:cursor-col-resize={isResizing}
>

    <aside
            style="width: {sidebarWidth}px;"
            class="h-full bg-white flex flex-col shrink-0 overflow-hidden"
    >
        <div class="p-3 border-b border-slate-100 shrink-0">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Folders</span>
        </div>

        <div class="flex-1 overflow-y-auto p-2 text-sm">
            {#snippet renderFolders(folders: FolderNode[])}
                {#each folders as folder (folder.id)}
                    {@const isExpanded = expandedFolders.has(folder.id)}

                    <div class="pl-2 border-l border-slate-100/70 my-0.5">

                        <div class="flex items-center w-full rounded-lg hover:bg-slate-100/60 transition-colors group select-none">

                            <button
                                    type="button"
                                    onclick={() => toggleFolder(folder.id)}
                                    class="p-1 text-slate-400 hover:text-slate-700 transition-transform duration-150 cursor-pointer w-6 h-6 flex items-center justify-center bg-transparent border-none outline-none focus:outline-none select-none"
                                    class:rotate-90={isExpanded}
                                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                                <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2.5"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        class="w-3 h-3"
                                >
                                    <polyline points="9 18 15 12 9 6"/>
                                </svg>
                            </button>
                            <a
                                    href="chrome://bookmarks/?id={folder.id}"
                                    onclick={(e) => openChromeFolderInBackground(e, folder.id)}
                                    class="flex-1 text-left py-1 pr-2 text-slate-700 group-hover:text-blue-600 transition-colors flex items-center gap-1.5 cursor-pointer truncate font-medium text-[13px] focus:outline-none"
                            >
                                <span class="text-slate-400 shrink-0 text-xs">{isExpanded ? '📂' : '📁'}</span>
                                <span class="truncate">{folder.title}</span>
                            </a>

                        </div>

                        {#if isExpanded}
                            {#if folder.bookmarks.length > 0}
                                <div class="pl-5 my-1 flex flex-col gap-0.5 border-l border-slate-100">
                                    {#each folder.bookmarks as bookmark (bookmark.id)}
                                        <a
                                                href={bookmark.url}
                                                onclick={(e) => openInBackground(e, bookmark.url)}
                                                class="text-[11px] text-slate-500 hover:text-blue-700 bg-transparent hover:bg-blue-50/40 border border-transparent hover:border-blue-300 rounded-md truncate px-1.5 py-0.5 transition-all cursor-pointer flex items-center gap-1"
                                                title={bookmark.title}
                                        >
                                            <span class="text-slate-300 shrink-0 text-[10px]">📄</span>
                                            <span class="truncate">{bookmark.title}</span>
                                        </a>
                                    {/each}
                                </div>
                            {/if}

                            {#if folder.children && folder.children.length > 0}
                                {@render renderFolders(folder.children)}
                            {/if}
                        {/if}

                    </div>
                {/each}
            {/snippet}

            {#if folderTree.length > 0}
                {@render renderFolders(folderTree)}
            {:else}
                <p class="text-xs text-slate-400 italic p-2">Loading structure...</p>
            {/if}
        </div>
    </aside>

    <div
            role="slider"
            tabindex="0"
            aria-label="Panel separator"
            aria-valuenow={sidebarWidth}
            aria-valuemin={180}
            aria-valuemax={450}
            onmousedown={startResize}
            onkeydown={(e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        sidebarWidth = Math.max(180, sidebarWidth - 10);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        sidebarWidth = Math.min(450, sidebarWidth + 10);
      }
    }}
            class="w-1 h-full cursor-col-resize bg-slate-200/60 hover:bg-blue-500 active:bg-blue-600 transition-colors shrink-0 outline-none"
            class:bg-blue-500={isResizing}
    ></div>

    <section class="flex-1 h-full flex flex-col overflow-hidden">
        <div class="w-full px-4 pt-4 pb-2 shrink-0">
            <div class="relative w-full">
                <input
                        type="text"
                        value={query}
                        oninput={onSearchInput}
                        placeholder="Start searching..."
                        class="w-full px-4 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs transition-colors"
                        disabled={!isInitialized}
                />

                {#if query.length > 0}
                    <button
                            title="clear"
                            onclick={clearSearch}
                            type="button"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600
            p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4"
                             fill="none" viewBox="0 0 24 24"
                             stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                {/if}
            </div>
        </div>

        <div class="flex-1 overflow-y-auto overflow-x-hidden py-2 mb-2">
            {#if !isInitialized}
                <p class="text-center text-sm text-slate-400 italic mt-6">
                    Synchronization with Chrome database...</p>
            {:else}
                {#if results.length > 0}
                    <div class="flex flex-col gap-2">
                        {#each results as item (item.id)}
                            <div class="mx-4 p-3 bg-white rounded-xl border border-slate-200/60 shadow-xs flex flex-col gap-1 w-[calc(100%-32px)]">

                                <div class="text-sm font-semibold text-left wrap-break-word w-full">
                                    <a
                                            href={item.url}
                                            onclick={(e) => openInBackground(e, item.url)}
                                            class="text-blue-700 hover:text-blue-900 hover:underline inline wrap-break-word cursor-pointer"
                                    >
                                        {item.title}
                                    </a>
                                </div>

                                <div class="text-xs text-slate-500 text-left break-all font-mono flex flex-wrap items-center gap-x-1 w-full leading-relaxed">
                                    <span class="text-slate-400">📁</span>
                                    {#if item.pathNodes.length > 0}
                                        {#each item.pathNodes as node, index (node.id)}
                                            <a
                                                    href="chrome://bookmarks/?id={node.id}"
                                                    onclick={(e) => openChromeFolderInBackground(e, node.id)}
                                                    class="text-slate-600 hover:text-blue-600 hover:underline inline break-all cursor-pointer font-medium"
                                            >
                                                {node.title}
                                            </a>
                                            {#if index < item.pathNodes.length - 1}
                                                <span class="text-slate-300 mx-0.5">/</span>
                                            {/if}
                                        {/each}
                                    {:else}
                                        <span class="text-slate-400 italic">Root</span>
                                    {/if}
                                </div>

                            </div>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
    </section>
</main>

