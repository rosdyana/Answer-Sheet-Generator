import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [image, setImage] = useState(null);
  const [answerKeyFromApi, setAnswerKeyFromApi] = useState({});
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

  // NEW STATES FOR TIMER
  const [testDurationMinutes, setTestDurationMinutes] = useState(60); // Default 60 minutes
  const [remainingTimeSeconds, setRemainingTimeSeconds] = useState(testDurationMinutes * 60);
  const [timerActive, setTimerActive] = useState(false);
  const timerIntervalRef = useRef(null); // Ref to hold the interval ID

  const BACKEND_URL = 'http://localhost:3056';

  // --- Helper function to reset all states, including timer states ---
  const resetAppState = useCallback(() => {
    setImage(null);
    setAnswerKeyFromApi({});
    setEditedAnswerKey({});
    setUserAnswers({});
    setScore(null);
    setWrongAnswers([]);
    setLoading(false);
    setError('');
    setShowImagePreview(false);
    setStartQuestion(null);
    setEndQuestion(null);
    setShowReviewSection(true); // Always show review initially for new input

    // Reset timer states
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    setTimerActive(false);
    setRemainingTimeSeconds(testDurationMinutes * 60); // Reset to full duration
  }, [testDurationMinutes]); // Add testDurationMinutes to dependency array


  const processImageWithBackend = useCallback(async (file) => {
    resetAppState();
    setLoading(true);
    setShowImagePreview(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64Data = reader.result.split(',')[1];
      const mimeType = file.type;

      try {
        const response = await fetch(`${BACKEND_URL}/upload-answer-key`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageData: base64Data,
            imageMimeType: mimeType,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Answer Key from Backend API:", data.answerKey);

        setAnswerKeyFromApi(data.answerKey);
        const detectedQNums = Object.keys(data.answerKey).map(Number);
        const inferredStart = detectedQNums.length > 0 ? Math.min(...detectedQNums) : null;
        const inferredEnd = detectedQNums.length > 0 ? Math.max(...detectedQNums) : null;

        setStartQuestion(inferredStart);
        setEndQuestion(inferredEnd);

        generateEditableKey(inferredStart, inferredEnd, data.answerKey);
        setShowReviewSection(true);

      } catch (err) {
        console.error("API Error:", err);
        setError(`Failed to process image: ${err.message}. Please try again or manually input the answer key.`);
        setAnswerKeyFromApi({});
        setEditedAnswerKey({});
        setStartQuestion(null);
        setEndQuestion(null);
        setShowReviewSection(true);
      } finally {
        setLoading(false);
        setShowImagePreview(false);
      }
    };

    reader.onerror = () => {
      setError("Failed to read image file.");
      setLoading(false);
      setShowImagePreview(false);
    };
  }, [resetAppState]);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      processImageWithBackend(file);
    }
  };

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

        setAnswerKeyFromApi(loadedKey);
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

  useEffect(() => {
    if (startQuestion !== null && endQuestion !== null) {
      const currentMinQ = Object.keys(editedAnswerKey).length > 0 ? parseInt(Object.keys(editedAnswerKey)[0]) : null;
      const currentMaxQ = Object.keys(editedAnswerKey).length > 0 ? parseInt(Object.keys(editedAnswerKey)[Object.keys(editedAnswerKey).length - 1]) : null;

      if (currentMinQ !== startQuestion || currentMaxQ !== endQuestion || Object.keys(editedAnswerKey).length === 0) {
        generateEditableKey(startQuestion, endQuestion, answerKeyFromApi);
      }
    }
  }, [startQuestion, endQuestion, generateEditableKey, answerKeyFromApi, editedAnswerKey]);


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
      setScore(null); // Clear score when key changes
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
      // Timer has run out, force submit
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      setTimerActive(false);
      handleSubmitTest(new Event('submit')); // Force submit
      alert("Time's up! Your test has been submitted automatically.");
    }

    // Cleanup function for the effect
    return () => {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    };
  }, [timerActive, remainingTimeSeconds]); // Dependencies for the effect

  const startTimer = () => {
    if (!timerActive && Object.keys(editedAnswerKey).length > 0) {
      setTimerActive(true);
      setScore(null); // Clear previous results when starting a new test
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
    setUserAnswers({}); // Clear user answers on reset
    setScore(null);
    setWrongAnswers([]);
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSubmitTest = (event) => {
    // Prevent default form submission if it's a real event from a button click
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    // Stop the timer if it's active when submitting
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
            Upload Image (AI OCR)
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
              <p>Based on {inputMethod === 'uploadImage' ? 'AI' : 'loaded JSON'}, we inferred questions from <strong style={{ color: 'green' }}>{startQuestion || 'N/A'}</strong> to <strong style={{ color: 'green' }}>{endQuestion || 'N/A'}</strong>. Adjust if needed.</p>

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
                  onClick={() => generateEditableKey(startQuestion, endQuestion, answerKeyFromApi)}
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
                    setRemainingTimeSeconds(newDuration * 60); // Update remaining time
                  } else if (e.target.value === '') { // Allow empty input temporarily
                    setTestDurationMinutes('');
                    setRemainingTimeSeconds(0);
                  }
                }}
                min="1"
                disabled={timerActive} // Disable input while timer is active
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
                    required={timerActive} // Required only when timer is active
                    disabled={!timerActive && score !== null} // Disable input if not active AND already submitted
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