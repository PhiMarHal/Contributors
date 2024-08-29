
let contract;
let readOnlyContract;
let currentPage = 0;
let totalPages = 0;
let cachedPages = {};
let loadingAnimationInterval;


const ANIMATION_SPEED = 10; // ms between each step
const HIGHLIGHT_COLOR = '#8A2BE2'; // Purple
const HIGHLIGHT_WIDTH = 64; // Number of runes to highlight at once

function initializeRunes() {
    const leftRunes = document.getElementById('leftRunes');
    const rightRunes = document.getElementById('rightRunes');

    if (leftRunes && rightRunes) {
        leftRunes.innerHTML = Array.from(leftRunes.textContent).map(rune => `<tspan class="rune">${rune}</tspan>`).join('');
        rightRunes.innerHTML = Array.from(rightRunes.textContent).map(rune => `<tspan class="rune">${rune}</tspan>`).join('');
        console.log("Runes initialized");
    }
}

let isAnimating = false;
let animationFrame = null;

function startLoadingAnimation() {
    if (isAnimating) return; // Don't start a new animation if one is already running

    console.log("startLoadingAnimation called");
    const leftRunes = document.querySelectorAll('#leftRunes .rune');
    const rightRunes = document.querySelectorAll('#rightRunes .rune');

    console.log(`Left runes: ${leftRunes.length}, Right runes: ${rightRunes.length}`);

    if (leftRunes.length === 0 || rightRunes.length === 0) {
        console.log("Runes not found, skipping animation");
        return;
    }

    console.log("Starting loading animation");

    const allRunes = [...leftRunes, ...rightRunes];
    let currentIndex = 0;
    let lastAnimationTime = 0;

    isAnimating = true;

    function animateRunes(currentTime) {
        if (!isAnimating) {
            return;  // Stop the animation if isAnimating is false
        }

        if (currentTime - lastAnimationTime > ANIMATION_SPEED) {
            // Reset all runes
            allRunes.forEach(rune => rune.style.fill = '');

            // Highlight the current group of runes
            for (let i = 0; i < HIGHLIGHT_WIDTH; i++) {
                const leftIndex = (currentIndex + i) % leftRunes.length;
                const rightIndex = (currentIndex + i) % rightRunes.length;
                leftRunes[leftIndex].style.fill = HIGHLIGHT_COLOR;
                rightRunes[rightIndex].style.fill = HIGHLIGHT_COLOR;
            }

            currentIndex = (currentIndex + 1) % leftRunes.length;
            lastAnimationTime = currentTime;
        }

        animationFrame = requestAnimationFrame(animateRunes);
    }

    animationFrame = requestAnimationFrame(animateRunes);
}

function stopLoadingAnimation() {
    console.log("Stopping loading animation");
    isAnimating = false;

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    // Reset rune colors immediately
    const allRunes = document.querySelectorAll('.rune');
    allRunes.forEach(rune => {
        rune.style.fill = '';
    });
}

async function fetchCurrentPage() {
    try {
        startLoadingAnimation(); // Start animation immediately
        totalPages = await readOnlyContract.currentPage();
        await updatePage(totalPages);
    } catch (error) {
        console.error("Failed to fetch current page:", error);
        document.getElementById('storyContent').textContent = `Failed to fetch current page: ${error.message}`;
    } finally {
        stopLoadingAnimation(); // Ensure animation stops even if there's an error
    }
}

async function updatePage(pageNumber) {
    startLoadingAnimation(); // Start animation for page update
    try {
        pageNumber = Math.max(0, Math.min(pageNumber, totalPages));

        let pageContent;
        if (cachedPages[pageNumber]) {
            pageContent = cachedPages[pageNumber];
        } else {
            pageContent = await readOnlyContract.pageScript(pageNumber);
            cachedPages[pageNumber] = pageContent;
        }

        console.log("Page content (last 50 characters):", pageContent.slice(-50));
        console.log("Page content length:", pageContent.length);
        // Add 512 blank spaces to the end of the content
        pageContent = pageContent + '\u00A0'.repeat(512);

        document.getElementById('storyContent').textContent = pageContent;
        currentPage = pageNumber;
        document.getElementById('pageNumber').textContent = `PAGE ${pageNumber}`;

        document.getElementById('prevPage').style.opacity = (pageNumber === 0) ? '0.5' : '1';
        document.getElementById('nextPage').style.opacity = (pageNumber >= totalPages) ? '0.5' : '1';
    } catch (error) {
        console.error("Failed to fetch page:", error);
        document.getElementById('storyContent').textContent = `Failed to fetch page: ${error.message}`;
    } finally {
        stopLoadingAnimation(); // Ensure animation stops even if there's an error
    }
}

async function initializeApp() {
    try {
        const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
        readOnlyContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, provider);

        if (typeof window.ethereum !== 'undefined') {
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = web3Provider.getSigner();
            contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, signer);
        }

        initializeRunes();
        await fetchCurrentPage(); // This will start and stop the animation
        setupContributionPopup();
    } catch (error) {
        console.error("Failed to initialize app:", error);
        document.getElementById('storyContent').textContent = `Failed to initialize app: ${error.message}`;
        stopLoadingAnimation(); // Make sure to stop the animation if there's an error
    }
}

function initializeRunes() {
    const leftRunes = document.getElementById('leftRunes');
    const rightRunes = document.getElementById('rightRunes');

    if (leftRunes && rightRunes) {
        const runeText = 'ᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆ';
        const runeSpans = Array.from(runeText).map(rune => `<tspan class="rune">${rune}</tspan>`).join('');

        leftRunes.querySelector('textPath').innerHTML = runeSpans;
        rightRunes.querySelector('textPath').innerHTML = runeSpans;

        console.log("Runes initialized");
        console.log(`Left runes HTML: ${leftRunes.outerHTML}`);
        console.log(`Right runes HTML: ${rightRunes.outerHTML}`);
        console.log(`Left runes: ${leftRunes.querySelectorAll('.rune').length}, Right runes: ${rightRunes.querySelectorAll('.rune').length}`);
    } else {
        console.error("Rune containers not found in the DOM");
    }
}

function checkRuneVisibility() {
    const leftRunes = document.querySelectorAll('#leftRunes .rune');
    const rightRunes = document.querySelectorAll('#rightRunes .rune');

    console.log(`Checking rune visibility:`);
    console.log(`Left runes visible: ${leftRunes.length}, First left rune bounding box:`, leftRunes[0]?.getBoundingClientRect());
    console.log(`Right runes visible: ${rightRunes.length}, First right rune bounding box:`, rightRunes[0]?.getBoundingClientRect());
}


async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = web3Provider.getSigner();
            contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, signer);
            return true;
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            return false;
        }
    } else {
        alert("Please install MetaMask to contribute!");
        return false;
    }
}

async function contribute() {
    if (!await connectWallet()) return;

    const contribution = document.getElementById('contributionInput').value;
    if (contribution.length === 0 || contribution.length > 256) {
        alert("Contribution must be between 1 and 256 characters.");
        return;
    }

    try {
        const tx = await contract.contribute(contribution, { value: ethers.utils.parseEther("0.0002") });
        await tx.wait();
        alert("Contribution sent successfully!");
        document.getElementById('contributionInput').value = '';
        closePopup();
        fetchCurrentPage();
    } catch (error) {
        console.error("Failed to send contribution:", error);
        alert(`Failed to send contribution: ${error.message}`);
    }
}

function setupContributionPopup() {
    const popup = document.getElementById('contributionPopup');
    const contributeButton = document.getElementById('contributeButton');
    const closePopupButton = document.getElementById('closePopup');
    const submitContributionButton = document.getElementById('submitContribution');

    contributeButton.addEventListener('click', () => {
        popup.style.display = 'flex';
    });

    closePopupButton.addEventListener('click', closePopup);

    submitContributionButton.addEventListener('click', contribute);
}

function closePopup() {
    document.getElementById('contributionPopup').style.display = 'none';
}

document.getElementById('prevPage').addEventListener('click', () => updatePage(currentPage - 1));
document.getElementById('nextPage').addEventListener('click', () => updatePage(currentPage + 1));

window.addEventListener('load', initializeApp);