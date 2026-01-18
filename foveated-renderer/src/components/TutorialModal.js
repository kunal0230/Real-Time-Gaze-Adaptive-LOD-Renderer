/**
 * TutorialModal - Step-by-step guide for first-time users
 */

export class TutorialModal {
    constructor() {
        this.overlay = null;
        this.currentStep = 0;
        this.onClose = null;

        this.steps = [
            {
                title: 'Welcome to Foveated Rendering',
                content: 'This demo shows how eye tracking can optimize rendering performance by focusing detail where you look.',
                stepNum: '1'
            },
            {
                title: 'Position Your Face',
                content: 'Center your face in the oval guide. Good lighting helps the eye tracker work better.',
                stepNum: '2'
            },
            {
                title: 'Calibration',
                content: 'Follow the moving dots with your eyes. Keep your head still and look at each dot directly.',
                stepNum: '3'
            },
            {
                title: 'Explore the Scene',
                content: 'Look around the demo scene. Notice how visual detail follows your gaze in real-time.',
                stepNum: '4'
            }
        ];

        this._create();
    }

    _create() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'tutorial-overlay hidden';
        this.overlay.innerHTML = `
            <div class="tutorial-modal">
                <button class="tutorial-close" aria-label="Close">&times;</button>
                <div class="tutorial-step-num"></div>
                <h2 class="tutorial-title"></h2>
                <p class="tutorial-content"></p>
                <div class="tutorial-progress">
                    <div class="tutorial-dots"></div>
                </div>
                <div class="tutorial-actions">
                    <button class="tutorial-prev">Back</button>
                    <button class="tutorial-next">Next</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        this.overlay.querySelector('.tutorial-close').addEventListener('click', () => this.hide());
        this.overlay.querySelector('.tutorial-prev').addEventListener('click', () => this._prevStep());
        this.overlay.querySelector('.tutorial-next').addEventListener('click', () => this._nextStep());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        this._renderDots();
    }

    _renderDots() {
        const dotsContainer = this.overlay.querySelector('.tutorial-dots');
        dotsContainer.innerHTML = this.steps.map((_, i) =>
            `<span class="tutorial-dot ${i === this.currentStep ? 'active' : ''}" data-step="${i}"></span>`
        ).join('');

        dotsContainer.querySelectorAll('.tutorial-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                this.currentStep = parseInt(dot.dataset.step);
                this._updateContent();
            });
        });
    }

    _updateContent() {
        const step = this.steps[this.currentStep];

        this.overlay.querySelector('.tutorial-step-num').textContent = `Step ${step.stepNum}`;
        this.overlay.querySelector('.tutorial-title').textContent = step.title;
        this.overlay.querySelector('.tutorial-content').textContent = step.content;

        this.overlay.querySelectorAll('.tutorial-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentStep);
        });

        const prevBtn = this.overlay.querySelector('.tutorial-prev');
        const nextBtn = this.overlay.querySelector('.tutorial-next');

        prevBtn.style.visibility = this.currentStep === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Got it' : 'Next';
    }

    _prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this._updateContent();
        }
    }

    _nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this._updateContent();
        } else {
            this.hide();
        }
    }

    show() {
        this.currentStep = 0;
        this._updateContent();
        this.overlay.classList.remove('hidden');
    }

    hide() {
        this.overlay.classList.add('hidden');
        if (this.onClose) this.onClose();
    }
}
