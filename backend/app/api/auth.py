from flask import Blueprint, request, jsonify
from app import db, bcrypt
from app.models import User
from flask_jwt_extended import create_access_token

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "El correo ya está registrado"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(username=username, email=email, password=hashed_password, role='user')

    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "Usuario registrado exitosamente"}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 401

    is_valid = False
    if user.password.startswith('$2b$') or user.password.startswith('$2a$'):
        is_valid = bcrypt.check_password_hash(user.password, password)
    else:
        is_valid = (user.password == password)

    if not is_valid:
        return jsonify({"error": "Contraseña incorrecta"}), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"username": user.username, "role": user.role}
    )

    return jsonify({"access_token": access_token}), 200