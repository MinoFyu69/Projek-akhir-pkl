const bcrypt = require("bcrypt");

async function run() {
    const password = "pw";
    const saltRounds = 10;

    const hash = await bcrypt.hash(password, saltRounds);
    console.log("Hash:", hash);

    const isMatch = await bcrypt.compare(password, hash);
    console.log("Password cocok?", isMatch);
}

run();
