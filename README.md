function loop {
(cd ~/code/loop-monorepo-starter && npm run loop:$1 "${@:2}")
}
