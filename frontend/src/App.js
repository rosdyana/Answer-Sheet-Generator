import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js'; // Import Tesseract.js
import './App.css';

function App() {
  // --- State Declarations ---
  const [image, setImage] = useState(null);
  const [ocrResult, setOcrResult] = useState('');
  const [answerKeyFromOcr, setAnswerKeyFromOcr] = useState({});
  const [editedAnswerKey, setEditedAnswerKey] = useState({});
  const [userAnswers, setUserAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showImagePreview, setShowImagePreview] = useState(false);

  const [startQuestion, setStartQuestion] = useState(null);
  const [endQuestion, setEndQuestion] = useState(null);

  const [showReviewSection, setShowReviewSection] = useState(true);
  const [inputMethod, setInputMethod] = useState('uploadImage');

  // Timer states
  const [testDurationMinutes, setTestDurationMinutes] = useState(60);
  const [remainingTimeSeconds, setRemainingTimeSeconds] = useState(testDurationMinutes * 60);
  const [timerActive, setTimerActive] = useState(false);
  const timerIntervalRef = useRef(null);

  // Tesseract.js worker ref
  const workerRef = useRef(null);

  // --- Tesseract.js Worker Initialization ---
  useEffect(() => {
    const loadWorker = async () => {
      if (!workerRef.current) {
        console.log("Initializing Tesseract worker...");
        try {
          // CORRECTED: Removed the logger option that caused the DataCloneError
          workerRef.current = await createWorker(); // 1. Create worker instance
          console.log("Worker created:", workerRef.current);

          await workerRef.current.load(); // 2. Load the core Tesseract.js script
          console.log("Worker core loaded.");

          await workerRef.current.loadLanguage('eng'); // 3. Load the language data
          console.log("Language 'eng' loaded.");

          await workerRef.current.initialize('eng');   // 4. Initialize the Tesseract engine
          console.log("Tesseract worker initialized.");
        } catch (initError) {
          console.error("Failed to initialize Tesseract worker:", initError);
          setError("Failed to initialize OCR. Please check console for details.");
        }
      }
    };
    loadWorker();
    // Cleanup function for the effect
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        console.log("Tesseract worker terminated.");
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // --- Helper function to generate the editable key based on range and source key ---
  const generateEditableKey = useCallback((start, end, sourceKey) => {
    const newEditedKey = {};
    const newUAnswers = {};

    if (start !== null && end !== null && start <= end) {
      for (let i = start; i <= end; i++) {
        newEditedKey[i] = sourceKey[i] || '';
        newUAnswers[i] = '';
      }
    }
    const sortedKeys = Object.keys(newEditedKey).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const finalEditedKey = {};
    sortedKeys.forEach(qNum => {
      finalEditedKey[qNum] = newEditedKey[qNum];
    });

    setEditedAnswerKey(finalEditedKey);
    setUserAnswers(newUAnswers);
    setScore(null); // Clear score when answer key changes
    setWrongAnswers([]); // Clear wrong answers
  }, []);


  // --- Helper function to reset all states, including timer states ---
  const resetAppState = useCallback(() => {
    setImage(null);
    setOcrResult('');
    setAnswerKeyFromOcr({});
    setEditedAnswerKey({});
    setUserAnswers({});
    setScore(null);
    setWrongAnswers([]);
    setLoading(false);
    setError('');
    setShowImagePreview(false);
    setStartQuestion(null);
    setEndQuestion(null);
    setShowReviewSection(true);

    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    setTimerActive(false);
    setRemainingTimeSeconds(testDurationMinutes * 60);
  }, [testDurationMinutes]);


  // --- Parsing Logic for Tesseract.js raw text output ---
  const parseAndSetAnswerKey = useCallback((rawOcrText) => {
    const key = {};
    const questionRegex = /(\d+)\s*\(?\s*([ABCDabcd])\s*\)?/g;
    let match;
    const foundQuestionNumbers = new Set();
    const foundPairs = [];

    while ((match = questionRegex.exec(rawOcrText)) !== null) {
      const questionNumber = parseInt(match[1], 10);
      const correctAnswer = match[2].toUpperCase();
      foundPairs.push({ questionNumber, correctAnswer });
      foundQuestionNumbers.add(questionNumber);
    }

    foundPairs.sort((a, b) => a.questionNumber - b.questionNumber);

    foundPairs.forEach(pair => {
      key[pair.questionNumber] = pair.correctAnswer;
    });

    setAnswerKeyFromOcr(key);

    const sortedDetectedQNums = Array.from(foundQuestionNumbers).sort((a, b) => a - b);
    let inferredStart = sortedDetectedQNums.length > 0 ? sortedDetectedQNums[0] : null;
    let inferredEnd = sortedDetectedQNums.length > 0 ? sortedDetectedQNums[sortedDetectedQNums.length - 1] : null;

    if (inferredStart === null) {
      inferredStart = 1;
      inferredEnd = 10;
    }

    setStartQuestion(inferredStart);
    setEndQuestion(inferredEnd);

    generateEditableKey(inferredStart, inferredEnd, key);
  }, [generateEditableKey]);


  // --- Image processing using Tesseract.js ---
  const processImageWithTesseract = useCallback(async (file) => {
    if (!workerRef.current) {
      setError("Tesseract worker not initialized. Please try again or refresh.");
      setLoading(false);
      setShowImagePreview(false);
      return;
    }

    resetAppState();
    setLoading(true);
    setShowImagePreview(true);

    try {
      const { data: { text } } = await workerRef.current.recognize(file);
      setOcrResult(text);
      console.log("OCR Raw Text Result (Tesseract):", text);
      parseAndSetAnswerKey(text);
      setShowReviewSection(true);

    } catch (err) {
      console.error("OCR Error (Tesseract):", err);
      setError(`Failed to process image with OCR: ${err.message}. Please try again or manually input the answer key.`);
      setAnswerKeyFromOcr({});
      setEditedAnswerKey({});
      setStartQuestion(null);
      setEndQuestion(null);
      setShowReviewSection(true);
    } finally {
      setLoading(false);
      setShowImagePreview(false);
    }
  }, [resetAppState, parseAndSetAnswerKey]);


  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
      processImageWithTesseract(file);
    }
  };

  // --- Save to JSON ---
  const handleSaveToJson = () => {
    if (Object.keys(editedAnswerKey).length === 0) {
      alert("No answer key to save. Please process an image or load a key first.");
      return;
    }
    const fileName = `answer_key_${startQuestion || 'na'}-${endQuestion || 'na'}.json`;
    const jsonString = JSON.stringify(editedAnswerKey, null, 2);

    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    alert("Answer key saved successfully!");
  };

  // --- Load from JSON ---
  const handleLoadJson = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    resetAppState();
    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loadedKey = JSON.parse(e.target.result);
        if (typeof loadedKey !== 'object' || loadedKey === null || Array.isArray(loadedKey)) {
          throw new Error("Invalid JSON structure. Expected an object.");
        }
        const questionNumbers = Object.keys(loadedKey).map(Number).filter(n => !isNaN(n));
        if (questionNumbers.length === 0) {
          throw new Error("No valid question numbers found in JSON.");
        }

        const inferredStart = Math.min(...questionNumbers);
        const inferredEnd = Math.max(...questionNumbers);

        setStartQuestion(inferredStart);
        setEndQuestion(inferredEnd);

        setAnswerKeyFromOcr(loadedKey); // Store as if it came from OCR (for consistency)
        generateEditableKey(inferredStart, inferredEnd, loadedKey);
        setShowReviewSection(true);

      } catch (err) {
        console.error("Error loading JSON file:", err);
        setError(`Failed to load JSON file: ${err.message}. Please ensure it's a valid answer key JSON.`);
        resetAppState();
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read JSON file.");
      setLoading(false);
    };
    reader.readAsText(file);
  };


  // --- Effect for dynamic range changes (user input) ---
  useEffect(() => {
    if (startQuestion !== null && endQuestion !== null) {
      const currentMinQ = Object.keys(editedAnswerKey).length > 0 ? parseInt(Object.keys(editedAnswerKey)[0]) : null;
      const currentMaxQ = Object.keys(editedAnswerKey).length > 0 ? parseInt(Object.keys(editedAnswerKey)[Object.keys(editedAnswerKey).length - 1]) : null;

      if (currentMinQ !== startQuestion || currentMaxQ !== endQuestion || Object.keys(editedAnswerKey).length === 0) {
        generateEditableKey(startQuestion, endQuestion, answerKeyFromOcr);
      }
    }
  }, [startQuestion, endQuestion, generateEditableKey, answerKeyFromOcr, editedAnswerKey]);


  const handleEditedAnswerKeyChange = (question, value) => {
    setEditedAnswerKey(prev => ({
      ...prev,
      [question]: value.toUpperCase()
    }));
  };

  const handleAddQuestionToKey = () => {
    const newQNumStr = prompt("Enter new question number:");
    const newQNum = parseInt(newQNumStr, 10);

    if (!isNaN(newQNum) && newQNum > 0) {
      setEditedAnswerKey(prev => {
        const updated = { ...prev, [newQNum]: '' };
        const sorted = {};
        Object.keys(updated).sort((a, b) => parseInt(a) - parseInt(b)).forEach(k => sorted[k] = updated[k]);
        return sorted;
      });
      setUserAnswers(prev => ({ ...prev, [newQNum]: '' }));

      if (startQuestion === null || newQNum < startQuestion) {
        setStartQuestion(newQNum);
      }
      if (endQuestion === null || newQNum > endQuestion) {
        setEndQuestion(newQNum);
      }
    } else if (newQNumStr) {
      alert("Invalid question number. Please enter a positive integer.");
    }
  };

  const handleRemoveQuestionFromKey = (questionToRemove) => {
    if (window.confirm(`Are you sure you want to remove question ${questionToRemove}?`)) {
      setEditedAnswerKey(prev => {
        const newState = { ...prev };
        delete newState[questionToRemove];
        return newState;
      });
      setUserAnswers(prev => {
        const newState = { ...prev };
        delete newState[questionToRemove];
        return newState;
      });

      const remainingQuestions = Object.keys(editedAnswerKey).filter(q => q !== questionToRemove);
      if (remainingQuestions.length === 0) {
        setStartQuestion(null);
        setEndQuestion(null);
      } else {
        const newMin = Math.min(...remainingQuestions.map(Number));
        const newMax = Math.max(...remainingQuestions.map(Number));
        if (newMin !== startQuestion) setStartQuestion(newMin);
        if (newMax !== endQuestion) setEndQuestion(newMax);
      }
      setScore(null);
      setWrongAnswers([]);
    }
  };

  const handleUserAnswerChange = (question, value) => {
    setUserAnswers(prev => ({
      ...prev,
      [question]: value.toUpperCase()
    }));
  };

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (timerActive && remainingTimeSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setRemainingTimeSeconds(prevTime => prevTime - 1);
      }, 1000);
    } else if (remainingTimeSeconds === 0 && timerActive) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      setTimerActive(false);
      handleSubmitTest(new Event('submit'));
      alert("Time's up! Your test has been submitted automatically.");
    }

    return () => {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    };
  }, [timerActive, remainingTimeSeconds]);

  const startTimer = () => {
    if (!timerActive && Object.keys(editedAnswerKey).length > 0) {
      setTimerActive(true);
      setScore(null);
      setWrongAnswers([]);
    } else if (Object.keys(editedAnswerKey).length === 0) {
      alert("Please load or create an answer key before starting the test.");
    }
  };

  const pauseTimer = () => {
    setTimerActive(false);
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
  };

  const resetTimer = () => {
    pauseTimer();
    setRemainingTimeSeconds(testDurationMinutes * 60);
    setUserAnswers({});
    setScore(null);
    setWrongAnswers([]);
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSubmitTest = (event) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    pauseTimer();

    let correctCount = 0;
    const incorrect = [];

    Object.entries(editedAnswerKey).forEach(([question, correctAnswer]) => {
      const userAnswer = userAnswers[question] ? userAnswers[question].trim() : '';
      if (userAnswer === correctAnswer) {
        correctCount++;
      } else {
        incorrect.push({
          question: question,
          userAnswer: userAnswer,
          correctAnswer: correctAnswer
        });
      }
    });

    setScore(correctCount);
    setWrongAnswers(incorrect);
  };

  const sortedQuestionsFromKey = Object.keys(editedAnswerKey).sort((a, b) => parseInt(a) - parseInt(b));

  const shouldShowReviewAndSimulation = sortedQuestionsFromKey.length > 0;

  return (
    <div className="App">
      <h1>Answer Sheet Grader</h1>

      <div className="input-method-selection">
        <h2>1. Choose Input Method</h2>
        <div className="radio-buttons">
          <label>
            <input
              type="radio"
              value="uploadImage"
              checked={inputMethod === 'uploadImage'}
              onChange={() => { setInputMethod('uploadImage'); resetAppState(); }}
            />
            Upload Image (Tesseract.js OCR)
          </label>
          <label>
            <input
              type="radio"
              value="loadJson"
              checked={inputMethod === 'loadJson'}
              onChange={() => { setInputMethod('loadJson'); resetAppState(); }}
            />
            Load from JSON File
          </label>
        </div>
      </div>

      {inputMethod === 'uploadImage' && (
        <div className="upload-section">
          <h3>Upload Answer Key Image</h3>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
          {loading && <p>Processing image, please wait...</p>}
          {error && <p className="error-message">{error}</p>}
        </div>
      )}

      {inputMethod === 'loadJson' && (
        <div className="load-json-section">
          <h3>Load Answer Key from JSON File</h3>
          <input type="file" accept=".json" onChange={handleLoadJson} />
          {loading && <p>Loading JSON, please wait...</p>}
          {error && <p className="error-message">{error}</p>}
        </div>
      )}

      {showImagePreview && image && (
        <div className="image-preview">
          <h3>Processing Image...</h3>
          <img src={image} alt="Uploaded Answer Key" style={{ maxWidth: '300px', border: '1px solid #ccc' }} />
        </div>
      )}

      {shouldShowReviewAndSimulation && (
        <>
          <div className="section-header-with-toggle">
            <h2>2. Review/Edit Answer Key</h2>
            <button
              className="toggle-button"
              onClick={() => setShowReviewSection(prev => !prev)}
            >
              {showReviewSection ? 'Hide Review' : 'Show Review'}
            </button>
          </div>
          {showReviewSection && (
            <div className="answer-key-review-section">
              <p>Based on {inputMethod === 'uploadImage' ? 'OCR' : 'loaded JSON'}, we inferred questions from <strong style={{ color: 'green' }}>{startQuestion || 'N/A'}</strong> to <strong style={{ color: 'green' }}>{endQuestion || 'N/A'}</strong>. Adjust if needed.</p>

              <div className="range-controls">
                <label>Start Question:
                  <input
                    type="number"
                    value={startQuestion || ''}
                    onChange={(e) => setStartQuestion(parseInt(e.target.value, 10) || null)}
                    min="1"
                  />
                </label>
                <label>End Question:
                  <input
                    type="number"
                    value={endQuestion || ''}
                    onChange={(e) => setEndQuestion(parseInt(e.target.value, 10) || null)}
                    min={startQuestion || 1}
                  />
                </label>
                <button
                  onClick={() => generateEditableKey(startQuestion, endQuestion, answerKeyFromOcr)}
                  disabled={!startQuestion || !endQuestion || startQuestion > endQuestion}
                >
                  Apply Range
                </button>
              </div>

              <div className="answer-key-grid">
                {sortedQuestionsFromKey.map(question => (
                  <div key={`key-${question}`} className="answer-item answer-key-item">
                    <label htmlFor={`key-q-${question}`}>{question}: </label>
                    <input
                      id={`key-q-${question}`}
                      type="text"
                      maxLength="1"
                      value={editedAnswerKey[question] || ''}
                      onChange={(e) => handleEditedAnswerKeyChange(question, e.target.value)}
                      pattern="[A-Da-d]"
                      title="Enter A, B, C, or D"
                    />
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => handleRemoveQuestionFromKey(question)}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="add-question-button" onClick={handleAddQuestionToKey}>
                + Add Single Question
              </button>
              <button type="button" className="save-json-button" onClick={handleSaveToJson}>
                Save Answer Key as JSON
              </button>
              <p className="note">Once you're satisfied with the answer key, proceed to test simulation.</p>
            </div>
          )}
        </>
      )}

      {shouldShowReviewAndSimulation && (
        <div className="simulation-section">
          <h2>3. Test Simulation (Enter Your Answers)</h2>
          <div className="timer-controls">
            <label>Test Duration (Minutes):
              <input
                type="number"
                value={testDurationMinutes}
                onChange={(e) => {
                  const newDuration = parseInt(e.target.value, 10);
                  if (!isNaN(newDuration) && newDuration >= 1) {
                    setTestDurationMinutes(newDuration);
                    setRemainingTimeSeconds(newDuration * 60);
                  } else if (e.target.value === '') {
                    setTestDurationMinutes('');
                    setRemainingTimeSeconds(0);
                  }
                }}
                min="1"
                disabled={timerActive}
              />
            </label>
            <div className="timer-display">Time: {formatTime(remainingTimeSeconds)}</div>
            <button onClick={startTimer} disabled={timerActive || loading || Object.keys(editedAnswerKey).length === 0}>Start Test</button>
            <button onClick={pauseTimer} disabled={!timerActive}>Pause</button>
            <button onClick={resetTimer} disabled={timerActive && remainingTimeSeconds > 0}>Reset</button>
          </div>

          <form onSubmit={handleSubmitTest} className="answer-form">
            <div className="answer-grid">
              {sortedQuestionsFromKey.map(question => (
                <div key={`user-${question}`} className="answer-item">
                  <label htmlFor={`user-q-${question}`}>{question}: </label>
                  <input
                    id={`user-q-${question}`}
                    type="text"
                    maxLength="1"
                    value={userAnswers[question] || ''}
                    onChange={(e) => handleUserAnswerChange(question, e.target.value)}
                    pattern="[A-Da-d]"
                    title="Enter A, B, C, or D"
                    required={timerActive}
                    disabled={!timerActive && score !== null}
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="submit-button" disabled={loading || !timerActive}>Submit Test</button>
          </form>
        </div>
      )}

      {score !== null && (
        <div className="results-section">
          <h2>4. Results</h2>
          <p>Your Score: {score} / {Object.keys(editedAnswerKey).length}</p>

          {wrongAnswers.length > 0 ? (
            <div>
              <h3>Wrong Answers:</h3>
              <ul className="wrong-answers-list">
                {wrongAnswers.map((item, index) => (
                  <li key={index}>
                    Question {item.question}: Your Answer "{item.userAnswer}", Correct Answer "{item.correctAnswer}"
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Congratulations! All answers are correct!</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;