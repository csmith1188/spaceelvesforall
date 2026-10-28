import fs from "fs";
import path from "path";

const root = path.resolve("site");
const reps = [
  ["Men Of The Line.sqlite", "spaceelves.sqlite"],
  ["Men Of The Line", "Space Elves"],
  ["Men of the Line", "Space Elves"],
  ["lane-pusher-local", "space-elves-local"],
  ["lane\\.sid", "elves\\.sid"],
  ["lane.sid", "elves.sid"],
  ["motl.tooltips", "elves.tooltips"],
  ["motl.bgm", "elves.bgm"],
  ["motl.ref", "elves.ref"],
  ["motl.bid", "elves.bid"],
];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(js|ejs|css|md)$/.test(ent.name)) {
      let s = fs.readFileSync(p, "utf8");
      let n = s;
      for (const [a, b] of reps) n = n.split(a).join(b);
      if (n !== s) {
        fs.writeFileSync(p, n);
        console.log("updated", path.relative(root, p));
      }
    }
  }
}

walk(root);
