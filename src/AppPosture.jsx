import './PostureApp.css';
import React, { useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

const PostureApp = () => {
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(null);


  // const handleFileChange = (e) => {
  //   setVideoFile(e.target.files[0]);
  //   setResults(null);
  // };
  const handleFileChange = async (e) => {
  const file = e.target.files[0];
  // console.log(e.target.files);
  setVideoFile(file);
  setResults(null);

  const formData = new FormData();
  formData.append('video', file);

  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/upload`, {

      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    const videoURL = `${process.env.REACT_APP_API_URL}${data.url}`;

    setUploadedVideoUrl(videoURL); 
  } catch (error) {
    console.error('Error uploading video:', error);
    alert('Upload failed');
  }
};



  const calculateAngle = (A, B, C) => {
    const AB = { x: B.x - A.x, y: B.y - A.y };
    const CB = { x: B.x - C.x, y: B.y - C.y };
    const dot = AB.x * CB.x + AB.y * CB.y;
    const magAB = Math.sqrt(AB.x ** 2 + AB.y ** 2);
    const magCB = Math.sqrt(CB.x ** 2 + CB.y ** 2);
    const angleRad = Math.acos(dot / (magAB * magCB));
    return angleRad * (180 / Math.PI);
  };

  const analyzeVideo = async () => {
    if (!videoFile) {
      alert('Please upload a video file first.');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      await tf.setBackend('webgl');
      await tf.ready();

      const detector = await poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
        runtime: 'tfjs',
        modelType: 'full',
      });

      const videoElement = document.createElement('video');
      videoElement.src = URL.createObjectURL(videoFile);
      videoElement.muted = true;
      videoElement.playsInline = true;
      await videoElement.play();

      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');

      let slouchBad = 0, slouchGood = 0;
      let deskBad = 0, deskGood = 0;
      let squatBad = 0, squatGood = 0;

      const analyzeFrame = async () => {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const input = tf.browser.fromPixels(canvas);
        const poses = await detector.estimatePoses(input);
        input.dispose();

        if (poses.length > 0) {
          const kp = poses[0].keypoints.reduce((map, k) => {
            map[k.name] = k;
            return map;
          }, {});

          // Slouching check
        if (kp.left_hip && kp.left_shoulder && kp.left_ear) {
             const slouchAngle = calculateAngle(kp.left_hip, kp.left_shoulder, kp.left_ear);

             if (slouchAngle < 150) {
                slouchBad++;
             } else {
                slouchGood++;
             }
        }


          // Desk sitting check
          if (kp.left_ear && kp.left_shoulder && kp.left_hip &&
              kp.right_ear && kp.right_shoulder && kp.right_hip) {
            const neckAngleL = calculateAngle(kp.left_ear, kp.left_shoulder, kp.left_hip);
            const neckAngleR = calculateAngle(kp.right_ear, kp.right_shoulder, kp.right_hip);
            if (neckAngleL > 30 || neckAngleR > 30) deskBad++;
            else deskGood++;
          }

          // Squat check only if squatting posture is suspected
          if (
            kp.left_hip && kp.left_knee && kp.left_ankle &&
            kp.right_hip && kp.right_knee && kp.right_ankle
          ) {
            const hipHeight = (kp.left_hip.y + kp.right_hip.y) / 2;
            const ankleHeight = (kp.left_ankle.y + kp.right_ankle.y) / 2;
            const heightDiff = hipHeight - ankleHeight;

            if (heightDiff < 150) { 
              const angleL = calculateAngle(kp.left_ankle, kp.left_hip, kp.left_shoulder || kp.left_knee);
              const angleR = calculateAngle(kp.right_ankle, kp.right_hip, kp.right_shoulder || kp.right_knee);
              if (angleL < 150 || angleR < 150) squatBad++;
              else squatGood++;
            }
          }
        }

        if (!videoElement.ended) {
          requestAnimationFrame(analyzeFrame);
        } else {
          setResults({
            slouch: { good: slouchGood, bad: slouchBad },
            desk: { good: deskGood, bad: deskBad },
            squat: { good: squatGood, bad: squatBad },
          });
          setLoading(false);
        }
      };

      analyzeFrame();

    } catch (err) {
      console.error('Error during analysis:', err);
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Posture Detection</h1>
      <input type="file" accept="video/*" onChange={handleFileChange} />
      <button onClick={analyzeVideo} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze Video'}
      </button>

      {loading && <p>⏳ Analyzing video, please wait...</p>}
      {results && (
        <div className="results">
          <h3>Results:</h3>
          <p>Slouching - Good: {results.slouch.good}, Bad: {results.slouch.bad}</p>
          <p>Desk Sitting - Good: {results.desk.good}, Bad: {results.desk.bad}</p>
          <p>Squatting - Good: {results.squat.good}, Bad: {results.squat.bad}</p>
        </div>
      )}
    </div>
  );
};

export default PostureApp;