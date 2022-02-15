// import { cv } from 'opencv-wasm';
// import { matToBitmap } from '../../utils/bmp';

// const detector = new cv.ORB();
// const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true); // crosscheck: true

// type CVMat = any;

// function testOutput(filename: string, idx: number, img1: CVMat, key1: any, img2: CVMat, key2: any, matches: any) {
//   const result = new cv.Mat();

//   // cv.drawKeypoints(img1, k1, result);
//   // void drawMatches_wrapper(
//     // const cv::Mat& arg1,                  // img1
//     // const std::vector<KeyPoint>& arg2,    // k1
//     // const cv::Mat& arg3,                  // img2
//     // const std::vector<KeyPoint>& arg4,    // k2
//     // const std::vector<DMatch>& arg5,      // matches
//     // cv::Mat& arg6,                        // result
//     // const Scalar& arg7,                   // matchColor – マッチの色（線分と，それで接続されるキーポイント）． matchColor==Scalar::all(-1) の場合，ランダムに色が生成されます
//     // const Scalar& arg8,                   // singlePointColor – シングルキーポイント，つまり，マッチを持たないキーポイントの色（円）． singlePointColor==Scalar::all(-1) の場合，ランダムに色が生成されます
//     // const std::vector<char>& arg9,        // matchesMask – どのマッチが描画されるかを指定するマスク．これが空の場合は，すべてのマッチが描画されます
//     // int arg10) {  // flag?                // flags – flags の各ビットは，描画のプロパティを設定します． 取り得る flags ビット値は， DrawMatchesFlags で定義されます．以下を参照してください

//   cv.drawMatches(img1, key1, img2, key2, matches, result);

//   matToBitmap(filename, result);

//   result.delete();
// }

// function orbMatch(idx: number, filename: string, img1: CVMat, k1: any, d1: any, img2: CVMat, k2: any, d2: any) {
//   const matches = new cv.DMatchVector();
//   const mask = new cv.Mat();

//   matcher.match(d1, d2, matches, mask);

//   testOutput(filename, idx, img1, k1, img2, k2, matches);

//   matches.delete()
//   mask.delete();

//   return matches;
// }

// module.exports = {
//   init: async (setting: any, commonConfig: any) => {
//     // const { templates } = settings;

//     // const keyPoints = new cv.KeyPointVector();
//     // const descriptors = new cv.Mat();
//     // detector.detect(origMat, keyPoints);
//     // detector.compute(origMat, keyPoints, descriptors);
//     // console.log('kp:', name, keyPoints.size());
//   },

//   process: (idx: number, mat: CVMat, setting: any, commonConfig: any) => {
//     const keyPoints = new cv.KeyPointVector();
//     const descriptors = new cv.Mat();
//     detector.detect(mat, keyPoints);
//     detector.compute(mat, keyPoints, descriptors);

//     const results = templates.flatMap((name) => {
//       const { mat: tempMat, origMat: origTempMat, orb, area } = TEMPLATES[_name];

//       const orbMatchTest = orbMatch(
//         idx,
//         `orbtest.${idx}.${name}.png`,
//         origMat,
//         keyPoints,
//         descriptors,
//         origTempMat,
//         orb.keyPoints,
//         orb.descriptors
//       );

//       return orbMatchTest;
//     });

//     keyPoints.delete();
//     descriptors.delete();

//     return results;
//   },
// }
