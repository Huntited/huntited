# Huntited

_English · [Français](README.fr.md)_

**Everyone or no one.** Huntited lets people commit to act _only if enough
others do too_: clean up a beach, switch apps together, launch a project,
speak up… Alone it's risky; together it works. Until the threshold is
reached, nobody is exposed. Inspired by
[Project Staghunt](https://hashd.ag/project-staghunt-six-pager.pdf)
(assurance contracts for coordination).

- Website: **[huntited.com](https://huntited.com)** (static, no server)
- Android app **Huntited Chat**:
  [codeberg.org/Huntited/huntited-chat](https://codeberg.org/Huntited/huntited-chat)
  (GPL fork of bitchat: encrypted rooms, Bluetooth without internet)

⚠️ **Prototype on the Kaspa test network (testnet-10).** Test KAS have no
value; deposits are simulated.

## How it works

1. Someone creates a **hunt**: an action, a deadline and a threshold
   ("we go if there are at least 15 of us").
2. Everyone **commits** on their own, with a personal threshold if they
   want ("I'm in if there are at least 30 of us"). Progress is never shown
   before the hunt triggers.
3. As soon as a group exists in which everyone's threshold is met, the
   hunt **triggers for everyone at the same time**. An encrypted room,
   open to members only, opens to get organised.
4. Otherwise nothing happens, and nobody was exposed.

You can **withdraw** a commitment until the hunt triggers, and **chain**
hunts ("I commit to B only if A has triggered").

## Architecture

| Part          | Technology                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Website       | React 19, TypeScript, TanStack Router, Tailwind; static build served by Codeberg Pages and mirrored on IPFS       |
| Registry      | Kaspa transactions (testnet-10) to a shared address carrying an `HNT1…` message; every browser rebuilds the state |
| Wallet        | Built-in wallet (BIP39, Schnorr signatures, wRPC submission); Kastle optional                                     |
| Rooms         | End-to-end encrypted messages over Nostr relays; also relayed over Bluetooth by the app                           |
| Site releases | Each published version is anchored on Kaspa (hash of its files) and can be verified from the site                 |

There is **no Huntited server**: each browser reads the registry from the
public Kaspa API and recomputes the state of every hunt
(`src/lib/onchain/`, tested in `ledger.test.ts`). Nobody holds the
registry address key: it is derived from a public phrase, so anyone can
check it (`addresses.test.ts`).

## Development

```bash
npm install
npm run dev            # dev server (demo hunts stored in the browser)
npm test               # tests (vitest)
npm run lint
npm run build:static   # static build in dist-static/ (test registry)
npm run routes         # after adding or removing a page in src/routes
```

Code comments and docs are in French. Detailed documentation in
[`docs/`](docs): registry ([registre-kaspa.md](docs/registre-kaspa.md)),
personal thresholds ([seuil-personnel.md](docs/seuil-personnel.md)),
withdrawal and chained hunts
([chasses-enchainees.md](docs/chasses-enchainees.md)), rooms
([chat.md](docs/chat.md)), wallet ([wallet.md](docs/wallet.md)), missions
([missions.md](docs/missions.md)), app ([app.md](docs/app.md)).

Project rules: [`AGENTS.md`](AGENTS.md). Contributions are welcome:
open an issue or a pull request.

## License

[GNU AGPL-3.0](LICENSE) or later. Any modified version running online
must publish its source code.
