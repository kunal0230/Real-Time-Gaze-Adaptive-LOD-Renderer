/**
 * SceneCard - Card component for scene selection
 */

export class SceneCard {
    constructor(scene, onSelect) {
        this.scene = scene;
        this.onSelect = onSelect;
        this.element = null;
        this.isSelected = false;

        this._create();
    }

    _create() {
        this.element = document.createElement('div');
        this.element.className = 'scene-card';
        this.element.innerHTML = `
            <div class="scene-thumbnail" style="background: ${this.scene.getThumbnail()}"></div>
            <div class="scene-info">
                <h3 class="scene-name">${this.scene.getName()}</h3>
                <p class="scene-desc">${this.scene.getDescription()}</p>
            </div>
            <div class="scene-badge">
                <span class="check-icon">✓</span>
            </div>
        `;

        this.element.addEventListener('click', () => {
            if (this.onSelect) this.onSelect(this.scene);
        });
    }

    setSelected(selected) {
        this.isSelected = selected;
        this.element.classList.toggle('selected', selected);
    }

    getElement() {
        return this.element;
    }
}
