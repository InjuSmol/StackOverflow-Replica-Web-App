import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginForm = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const handleInputChange = (event) => {
        const { id, value } = event.target;
        setFormData((prevData) => {
            const newData = { ...prevData, [id]: value };
            return newData;
        });
      };

    const completeLogin = async (event) => {
        event.preventDefault();

        if (!formData.email || !formData.password) {
            alert('Please fill in all required fields.');
            return;
        }

        try {
            const response = await axios.post('http://localhost:8000/login', formData, { withCredentials: true });
            //window.location.href = '/questions';
            if (response.data.success) {
                if (response.data.role === 'user') {
                    navigate('/questions');
                }
                else if (response.data.role === 'admin') {
                    navigate('/admin/dashboard');
                }
            }
            else {
                setErrorMessage(response.data.errorMessage);
            }
        } catch (error) {
            console.error('Error logging in', error);
            alert('Email or password incorrect. Please try again.');
        }
    };

    return (
        <form id="loginform" className="form-group">
            <div className="form-group-reg" style={{paddingLeft: '36%'}}>
                <h2 style={{visibility: 'hidden', marginBottom:'20px', marginTop: 0 }}>''</h2>
                <p style={{ display: 'block', textAlign: 'left', color: '#3d3d3d', padding: 0, margin:0 }}><i>  Provide email in form ********@****.**</i></p>
                <div style={{display: 'block', width: '100%'}}>
                <label className ="welc-label"> Email*</label> 
                <br />
                <input className ="welc-input" type='email' id='email' style={{height: '35px'}} value={formData.email} onChange={handleInputChange} required></input> 
                </div>
            </div>
            <div className="form-group-reg" style={{paddingLeft: '36%'}}>  
                {/*<p style={{ display: 'block', textAlign: 'left', color: '#3d3d3d', padding: 0, margin:0}}><i>Password may not contain your username or email</i></p>*/}
                <label className ="welc-label"> Password*</label>
                <br />
                <input className ="welc-input" type='password' id='password' style={{height: '35px'}} value={formData.password} onChange={handleInputChange} required></input> 
            </div>
            <div className="form-group-reg" style={{textAlign: 'center', position: 'relative', paddingLeft: 0, width: '100%', paddingTop: '0px'}}>
                <button className="welc-the-button" onClick={completeLogin} type="submit">Login</button>
                {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
            </div>
        </form>
    )
}

export default LoginForm;