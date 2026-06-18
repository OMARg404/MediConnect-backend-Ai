const fs = require("fs");

// اقرأ ملف JSON
const data = JSON.parse(fs.readFileSync("allEntities.json", "utf8"));

// خزن الـ subTypes في Set عشان ما يكونش فيه تكرار
const subTypesSet = new Set();

data.forEach(entity => {
  if (entity.subType) {
    subTypesSet.add(entity.subType);
  }
});

// حول الـ Set لمصفوفة ورتبها
const subTypes = Array.from(subTypesSet).sort();

console.log("📂 All subTypes:");
subTypes.forEach((s, i) => console.log(`${i + 1}. ${s}`));