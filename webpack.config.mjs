import path from "path";
import {fileURLToPath} from "url";
import CopyWebpackPlugin from "copy-webpack-plugin";
import ExtReloader from "webpack-ext-reloader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = path.resolve(__dirname, "src");
const DIST = path.resolve(__dirname, "dist");

const isDev = process.env.NODE_ENV === "development";

export default {
    entry: {
        content: `${SRC}/content.js`,
        background: `${SRC}/background.js`,
    },
    output: {
        path: DIST,
        filename: "[name].js",
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {from: `${SRC}/manifest.json`, to: DIST},
                {from: `${SRC}/assets`, to: `${DIST}/assets`},
            ],
        }),
        ...(isDev
            ? [
                new ExtReloader({
                    manifest: `${SRC}/manifest.json`,
                    port: 9090,
                    reloadPage: true,
                    entries: {
                        contentScript: ["content-script"],
                        background: "background",
                    },
                }),
            ]
            : [])
    ],
    devtool: "source-map",
};