# Vendored ONNX Runtime notices

The `onnxruntime-web` and `onnxruntime-common` 1.22.0 npm packages omit their
license files. These unmodified files come from the corresponding upstream tag:

- https://github.com/microsoft/onnxruntime/blob/v1.22.0/LICENSE
- https://github.com/microsoft/onnxruntime/blob/v1.22.0/ThirdPartyNotices.txt

The web build includes the complete upstream third-party notice collection for
the precompiled WASM runtime. Some entries concern other ONNX backends.

When upgrading ONNX Runtime, update these files and the version guard in
`../license-notices.ts`, and replace the self-hosted runtime assets from that
same installed version. Builds never fetch licenses from the network.
