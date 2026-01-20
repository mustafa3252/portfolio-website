import * as THREE from "three";

import { EventEmitter } from "events";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import Experience from "../Experience.js";

const LOAD_TIMEOUT_MS = 15000; // 15 second timeout for asset loading

export default class Resources extends EventEmitter {
    constructor(assets) {
        super();
        this.experience = new Experience();
        this.renderer = this.experience.renderer;

        this.assets = assets;

        this.items = {};
        this.queue = this.assets.length;
        this.loaded = 0;
        this.hasError = false;
        this.percentageElement = document.querySelector(".loading-percentage");
        this.loadingBarFill = document.querySelector(".loading-bar-fill");

        this.setLoaders();
        this.startLoading();
        this.setLoadTimeout();
    }

    updatePercentage(percent) {
        if (this.percentageElement) {
            this.percentageElement.textContent = `${Math.round(percent)}%`;
        }
        if (this.loadingBarFill) {
            this.loadingBarFill.style.width = `${percent}%`;
        }
    }

    setLoaders() {
        this.loaders = {};
        this.loaders.gltfLoader = new GLTFLoader();
        this.loaders.dracoLoader = new DRACOLoader();
        this.loaders.dracoLoader.setDecoderPath("/draco/");
        this.loaders.gltfLoader.setDRACOLoader(this.loaders.dracoLoader);
    }

    setLoadTimeout() {
        this.loadTimeout = setTimeout(() => {
            if (this.loaded < this.queue && !this.hasError) {
                this.hasError = true;
                console.error(`Asset loading timed out after ${LOAD_TIMEOUT_MS / 1000}s. Loaded ${this.loaded}/${this.queue} assets.`);
                this.showErrorMessage();
            }
        }, LOAD_TIMEOUT_MS);
    }

    showErrorMessage() {
        const preloader = document.querySelector(".preloader");
        if (preloader) {
            preloader.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 20px;">
                    <p style="font-size: 18px; color: #333; margin-bottom: 16px;">Unable to load 3D scene</p>
                    <button onclick="location.reload()" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background: #e5a1aa; border: none; border-radius: 8px;">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    startLoading() {
        for (const asset of this.assets) {
            if (asset.type === "glbModel") {
                this.loaders.gltfLoader.load(
                    asset.path,
                    (file) => {
                        this.singleAssetLoaded(asset, file);
                    },
                    (progress) => {
                        // Calculate progress for this asset and overall
                        if (progress.lengthComputable) {
                            const assetProgress = progress.loaded / progress.total;
                            const overallProgress = ((this.loaded + assetProgress) / this.queue) * 100;
                            this.updatePercentage(overallProgress);
                        }
                    },
                    (error) => {
                        console.error(`Failed to load model: ${asset.path}`, error);
                        this.hasError = true;
                        this.showErrorMessage();
                    }
                );
            } else if (asset.type === "videoTexture") {
                this.video = {};
                this.videoTexture = {};

                this.video[asset.name] = document.createElement("video");
                this.video[asset.name].src = asset.path;
                this.video[asset.name].muted = true;
                this.video[asset.name].playsInline = true;
                this.video[asset.name].autoplay = true;
                this.video[asset.name].loop = true;
                this.video[asset.name].play();

                this.videoTexture[asset.name] = new THREE.VideoTexture(
                    this.video[asset.name]
                );
                this.videoTexture[asset.name].minFilter = THREE.NearestFilter;
                this.videoTexture[asset.name].magFilter = THREE.NearestFilter;
                this.videoTexture[asset.name].generateMipmaps = false;
                this.videoTexture[asset.name].encoding = THREE.sRGBEncoding;

                this.singleAssetLoaded(asset, this.videoTexture[asset.name]);
            }
        }
    }

    singleAssetLoaded(asset, file) {
        this.items[asset.name] = file;
        this.loaded++;

        // Update percentage display
        const percent = (this.loaded / this.queue) * 100;
        this.updatePercentage(percent);

        if (this.loaded === this.queue) {
            clearTimeout(this.loadTimeout);
            this.emit("ready");
        }
    }
}
