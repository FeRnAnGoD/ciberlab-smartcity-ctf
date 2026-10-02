from app import create_app, db, bcrypt
from app.models import User, Message

app = create_app()

with app.app_context():
    # Elimina y vuelve a crear las tablas respetando la integridad referencial
    db.drop_all()
    db.create_all()

    admin_pw = bcrypt.generate_password_hash('admin123').decode('utf-8')
    admin_user = User(
        username='Admin Supremo',
        email='admin@ciberlab.cl',
        password=admin_pw,
        role='admin'
    )
    
    db.session.add(admin_user)
    db.session.commit()
    print("--- ¡ÉXITO! Base de datos reinicializada correctamente ---")
    print("Credenciales Admin: admin@ciberlab.cl / admin123")