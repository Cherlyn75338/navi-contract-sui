import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
const pkgs = [
    "0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f",
    "0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1",
    "0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83",
];
function fmtType(t) {
    try {
        if (typeof t === "string")
            return t;
        return JSON.stringify(t);
    }
    catch {
        return String(t);
    }
}
async function main() {
    for (const pkg of pkgs) {
        console.log(`Package: ${pkg}`);
        // getNormalizedMoveModulesByPackage returns a map of module name -> NormalizedModule
        const modules = await client.getNormalizedMoveModulesByPackage({ package: pkg });
        for (const [modName, mod] of Object.entries(modules)) {
            const exposed = mod.exposedFunctions || {};
            for (const [fnName, fn] of Object.entries(exposed)) {
                const f = fn;
                if (f.isEntry) {
                    const params = (f.parameters || []).map(fmtType).join(", ");
                    const returns = (f.return || []).map(fmtType).join(", ");
                    console.log(` - ${modName}::${fnName}(${params}) -> (${returns})`);
                }
            }
        }
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=discover.js.map