export default (App, {popup = false}) => {
  Vue.mixin({
    methods: {
      t: browser.i18n.getMessage,
    }
  });

  new Vue({
    el: '#app',
    data: () => ({
      app: {
        initialized: false,
        popup,
        expandedPreferences: false
      }
    }),
    watch: {
      app: {
        async handler(app, oldApp) {
          if (!app.initialized || !oldApp.preferences) {
            return;
          }

          if (!popup) {
            await this.checkPermissions(app);
          }

          try {
            await browser.runtime.sendMessage({
              method: 'savePreferences',
              payload: {
                preferences: app.preferences
              }
            });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.log('error while saving preferences', error);
            this.$root.$emit('showError', 'Error while saving preferences');
          }

          if (app.preferences.ui.expandPreferences && !this.expandedPreferences) {
            Array.from(Array(15)).map((_, idx) => {
              $('.ui.accordion').accordion('open', idx);
            });
            this.expandedPreferences = true;
          } else if (!app.preferences.ui.expandPreferences && this.expandedPreferences) {
            this.expandedPreferences = false;
            this.$root.$emit('initialize');
          }
        },
        deep: true
      }
    },
    mounted() {
      this.initialize();

      this.$root.$on('initialize', () => {
        this.app.initialized = false;
        this.$nextTick(() => {
          this.initialize();
        });
      });
    },
    methods: {
      async initialize() {
        const {permissions: allPermissions} = await browser.permissions.getAll();
        const permissions = {
          bookmarks: allPermissions.includes('bookmarks'),
          history: allPermissions.includes('history'),
          notifications: allPermissions.includes('notifications')
        };

        let storage;
        try {
          // eslint-disable-next-line require-atomic-updates
          storage = await browser.storage.local.get(['preferences', 'statistics', 'tempContainers']);
          if (!storage.preferences || !Object.keys(storage.preferences).length) {
            this.$root.$emit('showPreferencesError');
            return;
          }
        } catch (error) {
          this.$root.$emit('showPreferencesError', error);
        }

        let activeTab = false;
        if (popup) {
          const [tab] = await browser.tabs.query({currentWindow: true, active: true});
          tab.parsedUrl = new URL(tab.url);
          activeTab = tab;
        }

        this.app = {
          initialized: true,
          popup,
          activeTab,
          storage,
          preferences: storage.preferences,
          permissions
        };
      },
      async checkPermissions(app) {
        if (app.preferences.notifications && !app.permissions.notifications) {
          // eslint-disable-next-line require-atomic-updates
          app.preferences.notifications = app.permissions.notifications =
            await browser.permissions.request({
              permissions: ['notifications']
            });
        }

        if (app.preferences.contextMenuBookmarks && !app.permissions.bookmarks) {
          // eslint-disable-next-line require-atomic-updates
          app.preferences.contextMenuBookmarks = app.permissions.bookmarks =
            await browser.permissions.request({
              permissions: ['bookmarks']
            });
        }

        if (app.preferences.deletesHistory.contextMenuBookmarks && !app.permissions.bookmarks) {
          // eslint-disable-next-line require-atomic-updates
          app.preferences.deletesHistory.contextMenuBookmarks = app.permissions.bookmarks =
            await browser.permissions.request({
              permissions: ['bookmarks']
            });
        }

        if (app.preferences.deletesHistory.active && !app.permissions.history) {
          // eslint-disable-next-line require-atomic-updates
          app.preferences.deletesHistory.active = app.permissions.history =
            await browser.permissions.request({
              permissions: ['history']
            });
        }
      }
    },
    render(h) {
      return h(App, {
        props: {
          app: this.app
        }
      });
    }
  });
};