.RECIPEPREFIX = >
UUID = ihsg-indicator@faishalmhmd.dev

pack:
> gnome-extensions pack --force --extra-source=utils.js .

install: pack
> gnome-extensions install --force $(UUID).shell-extension.zip

# symlink repo ke folder extension (untuk development)
dev:
> glib-compile-schemas schemas/
> ln -sfn $(CURDIR) $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: pack install dev
