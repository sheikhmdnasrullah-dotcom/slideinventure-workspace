// This directory is a Next.js (JavaScript/TypeScript) application, not Go
// source. The go.mod exists only so that `go build ./...` and `go test ./...`
// executed from the repository root skip this subtree: nested modules are
// excluded from `./...` patterns. Without it, Go files shipped inside
// workspace-app/node_modules (e.g. flatted's golang port) are picked up by the
// root module and break every build and CI run.
//
// Do not add .go files here.
module github.com/gophish/gophish/workspace-app

go 1.21
