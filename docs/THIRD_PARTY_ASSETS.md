# Third-party assets

Counter-Strike 2 and the associated game assets are trademarks and copyrighted
works of Valve Corporation.

This project is an independent, unofficial project. It is **not** affiliated
with, endorsed by, sponsored by, or published by Valve Corporation.

## What this project owns

Everything under `src/`, `tools/`, `tests/`, `docs/`, `dev/` and the build
configuration is this project's own work and is covered by the project's licence.
That includes the asset *pipeline*: the CS2 detection, the VPK index reader, the
conversion driver, the optimizer, the validator, the manifest format and the
runtime loader.

The weapon models under `public/assets/weapons/` are clean-room recreations
authored for this project in Blender from the project's own reference renders.
They are not Valve assets.

## Valve-owned assets used during local development

Where Valve-owned assets are used, they come from the **user's own locally
installed copy of Counter-Strike 2**, obtained through Steam, and they are used
only to build development assets on that machine:

```text
Local, legally installed Counter-Strike 2
        -> VPK packs (read only, never modified)
        -> Source 2 Viewer (ValveResourceFormat, MIT licensed)
        -> glTF / GLB
        -> web optimization (WebP textures, meshopt geometry)
        -> the game's existing weapon pipeline
```

Nothing is downloaded from asset dumps, mirrors, torrents or repositories that
redistribute Valve binaries. The VPK files in the game directory are opened
read-only by `tools/cs2-assets/vpk.mjs` and are never written to.

### These assets are not in version control

The following paths are ignored by git, because they are derived from a
locally installed game:

```text
generated/cs2/                    raw conversions and reports
public/generated-assets/cs2/      the models the browser loads
tools/source2viewer/bin/          the conversion tool binary
config/local-assets.json          the machine's resolved install path
```

What *is* committed is the description of them: the extraction and conversion
scripts, the asset index schema, the weapon mapping table, the build manifest
format, and this document. A fresh clone therefore contains no Valve assets and
still runs - the game falls back to its own authored models.

## No redistribution

Do not commit, publish, upload or otherwise redistribute extracted Valve assets,
or the converted GLBs derived from them. The pipeline writes them locally for
development and the project never publishes them automatically.

This notice does not grant any redistribution right, and does not change the
terms of the Steam Subscriber Agreement or of any game-specific licence. Users
and other developers are responsible for complying with the applicable Steam
Subscriber Agreement, game-specific terms, copyright law and third-party asset
licences.

Running the pipeline requires the user to own Counter-Strike 2 on Steam. If you
do not own it, do not run `npm run assets:cs2`; the project works without it.

## Third-party assets that ship with this project

A small number of weapon finishes were supplied by the project owner and are
published in `public/assets/weapons/`. They are recorded with their author,
source and licence in `CREDITS.md` and in `public/assets/weapons/manifest.json`
under `provenance`, and they are distributed under the terms listed there
(CC-BY-4.0 for the Sketchfab models credited in `CREDITS.md`).

The conversion tool, [ValveResourceFormat](https://github.com/ValveResourceFormat/ValveResourceFormat),
is a separate open-source project, distributed under the MIT licence. It is a
build-time dependency only; it is not bundled with this project and it is
installed by `tools/source2viewer/setup.mjs`.
